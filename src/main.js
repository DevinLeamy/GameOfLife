import { fetchShaderFile } from "./helpers.js";
// Shader data.
const cellVertexShader = await fetchShaderFile("cell_vertex");
const cellFragmentShader = await fetchShaderFile("cell_fragment");
const cellComputeShader = await fetchShaderFile("cell_compute");
let running = false;
const toggleButton = document.getElementById("toggle-button");
const restartButton = document.getElementById("restart-button");
toggleButton.textContent = running ? "Running" : "Paused";
toggleButton.onclick = () => {
    running = !running;
    toggleButton.textContent = running ? "Running" : "Paused";
};
function generateInitialState() {
    const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);
    for (let i = 0; i < cellStateArray.length; ++i) {
        cellStateArray[i] = Math.random() > 0.8 ? 1 : 0;
    }
    return cellStateArray;
}
const BACKGROUND_COLOR = {
    r: 0.0,
    g: 0.0,
    b: 0.0,
    a: 1,
};
const GRID_SIZE = 22;
const UPDATE_INTERVAL = 200; // ms
const WORKGROUP_SIZE = 8;
const vertices = new Float32Array([
    // Bottom right corner triangle.
    -0.9, -0.9, 0.9, -0.9, 0.9, 0.9,
    // Top left corner triangle.
    -0.9, -0.9, -0.9, 0.9, 0.9, 0.9,
]);
// Create canvas.
const canvas = document.querySelector("canvas");
if (!canvas) {
    throw new Error("Canvas not found.");
}
const devicePixelRatio = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
// Create device.
if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
}
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error("No WedGPU adapter was found.");
}
const device = await adapter.requestDevice();
// Configure canvas.
const context = canvas.getContext("webgpu");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
// Associate the canvas with the device and the canvas format, the texture format the canvas will use.
context.configure({
    device,
    format: canvasFormat,
});
// Uniform buffer
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = device.createBuffer({
    label: "Cell uniforms",
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);
// Storage buffer
const cellStateArray = generateInitialState();
const cellStateStorage = [
    device.createBuffer({
        label: "(A) Cell state buffer",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
        label: "(B) Cell state buffer",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
];
restartButton.onclick = () => {
    device.queue.writeBuffer(cellStateStorage[0], 0, generateInitialState());
    device.queue.writeBuffer(cellStateStorage[1], 0, generateInitialState());
};
device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);
// Create an (empty) vertex buffer.
const vertexBuffer = device.createBuffer({
    label: "Two triangles",
    size: vertices.byteLength,
    // 1. Used for vertex data.
    // 2. Can copy data into it.
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
// Fill the buffer with vertex data.
device.queue.writeBuffer(vertexBuffer, 0, vertices);
// Describe the layout of the vertex buffer data.
const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [
        {
            format: "float32x2",
            offset: 0,
            shaderLocation: 0,
        },
    ],
};
const cellVertexModule = device.createShaderModule({
    label: "Cell vertex shader",
    code: cellVertexShader,
});
const cellFragmentModule = device.createShaderModule({
    label: "Cell fragment shader",
    code: cellFragmentShader,
});
const cellComputeModule = device.createShaderModule({
    label: "Cell computer shader",
    code: cellComputeShader,
});
const bindGroupLayout = device.createBindGroupLayout({
    label: "Cell bind group layout",
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
            buffer: {
                type: "uniform",
            },
        },
        {
            binding: 1,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: {
                type: "read-only-storage",
            },
        },
        {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
                type: "storage",
            },
        },
    ],
});
const pipelineLayout = device.createPipelineLayout({
    label: "Cell pipeline layout",
    bindGroupLayouts: [bindGroupLayout],
});
const cellRenderPipeline = device.createRenderPipeline({
    label: "Cell render, pipeline",
    layout: pipelineLayout,
    vertex: {
        module: cellVertexModule,
        entryPoint: "vertexMain",
        buffers: [
            vertexBufferLayout,
        ],
    },
    fragment: {
        module: cellFragmentModule,
        entryPoint: "fragmentMain",
        targets: [
            {
                format: canvasFormat,
            },
        ],
    },
});
const cellComputePipeline = device.createComputePipeline({
    label: "Cell compute pipeline",
    layout: pipelineLayout,
    compute: {
        module: cellComputeModule,
        entryPoint: "computeMain",
    },
});
const bindGroups = [
    device.createBindGroup({
        label: "(A) Cell rendering bind group",
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                },
            },
            {
                binding: 1,
                resource: {
                    buffer: cellStateStorage[0],
                },
            },
            {
                binding: 2,
                resource: {
                    buffer: cellStateStorage[1],
                },
            },
        ],
    }),
    device.createBindGroup({
        label: "(B) Cell rendering bind group",
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                },
            },
            {
                binding: 1,
                resource: {
                    buffer: cellStateStorage[1],
                },
            },
            {
                binding: 2,
                resource: {
                    buffer: cellStateStorage[0],
                },
            },
        ],
    }),
];
let currentStep = 0;
function update() {
    const encoder = device.createCommandEncoder();
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(cellComputePipeline);
    computePass.setBindGroup(0, bindGroups[currentStep % 2]);
    const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCount, workgroupCount);
    computePass.end();
    if (running) {
        ++currentStep;
    }
    // Clear canvas.
    const pass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: BACKGROUND_COLOR,
                loadOp: "clear",
                storeOp: "store",
            },
        ],
    });
    // Provide the pipeline, vertex data, and number of vertices to draw.
    pass.setPipeline(cellRenderPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroups[currentStep % 2]);
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // # of vertices to draw (each vertex has two floats)
    // End the render pass.
    pass.end();
    // Submit the commands to the device, to be run.
    device.queue.submit([encoder.finish()]);
}
setInterval(update, UPDATE_INTERVAL);
