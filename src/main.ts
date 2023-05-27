import { fetchShaderFile } from "./helpers.js"

// Shader data.
const cellVertexShader = await fetchShaderFile("cell_vertex")
const cellFragmentShader = await fetchShaderFile("cell_fragment")

const BACKGROUND_COLOR: GPUColor = {
    r: 0.2,
    g: 0.2,
    b: 0.9,
    a: 1,
}
const vertices = new Float32Array([
    // Bottom right corner triangle.
    -0.8, -0.8, 0.8, -0.8, 0.8, 0.8,

    // Top left corner triangle.
    -0.8, -0.8, -0.8, 0.8, 0.8, 0.8,
])

// Create canvas.
const canvas = document.querySelector("canvas")
if (!canvas) {
    throw new Error("Canvas not found.")
}
// Create device.
if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.")
}
const adapter = await navigator.gpu.requestAdapter()
if (!adapter) {
    throw new Error("No WedGPU adapter was found.")
}
const device = await adapter.requestDevice()
// Configure canvas.
const context = canvas.getContext("webgpu")!
const canvasFormat = navigator.gpu.getPreferredCanvasFormat()
// Associate the canvas with the device and the canvas format, the texture format the canvas will use.
context.configure({
    device,
    format: canvasFormat,
})
// Create an (empty) vertex buffer.
const vertexBuffer = device.createBuffer({
    label: "Two triangles",
    size: vertices.byteLength,
    // 1. Used for vertex data.
    // 2. Can copy data into it.
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
})
// Fill the buffer with vertex data.
device.queue.writeBuffer(vertexBuffer, 0, vertices)
// Describe the layout of the vertex buffer data.
const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 8, // 4 (bytes per float) x 2 (floats per vertex)
    attributes: [
        {
            format: "float32x2",
            offset: 0,
            shaderLocation: 0, // location inside of the vertex shader
        },
    ],
}
const cellVertexModule = device.createShaderModule({
    label: "Cell shader",
    code: cellVertexShader,
})
const cellFragmentModule = device.createShaderModule({
    label: "Fragment shader",
    code: cellFragmentShader,
})

const cellPipeline = device.createRenderPipeline({
    label: "Cell pipeline",
    layout: "auto",
    vertex: {
        module: cellVertexModule,
        entryPoint: "vertexMain",
        buffers: [
            vertexBufferLayout, // @location(0)
        ],
    },
    fragment: {
        module: cellFragmentModule,
        entryPoint: "fragmentMain",
        targets: [
            {
                format: canvasFormat, // @location(0)
            },
        ],
    },
})

// Clear canvas.
const encoder = device.createCommandEncoder()
const pass = encoder.beginRenderPass({
    colorAttachments: [
        {
            view: context.getCurrentTexture().createView(), // view into the texture
            clearValue: BACKGROUND_COLOR,
            loadOp: "clear", // create the canvas when the pass beings
            storeOp: "store", // store the results of the pass into the texture
        },
    ],
})
// Provide the pipeline, vertex data, and number of vertices to draw.
pass.setPipeline(cellPipeline)
pass.setVertexBuffer(0, vertexBuffer)
pass.draw(vertices.length / 2) // # of vertices to draw (each vertex has two floats)
// End the render pass.
pass.end()
const commandBuffer = encoder.finish() // buffer of encoded commands
// Submit the commands to the device, to be run.
device.queue.submit([commandBuffer])
// Alternatively: device.queue.submit([encoder.finish()])
// because the commandBuffer cannot be reused

export {}
