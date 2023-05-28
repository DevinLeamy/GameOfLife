@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage> cellState: array<u32>;

struct VertexInput {
    @location(0) pos: vec2f,
    @builtin(instance_index) instance: u32
};

struct VertexOutput { 
    @builtin(position) pos: vec4f,
    @location(0) cell: vec2f 
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    let state = f32(cellState[input.instance]);

    let i = f32(input.instance);
    let cell = vec2f(i % grid.x, floor(i / grid.x));
    let corner_pos = (input.pos * state + 1.0) / grid - 1;
    let unit = 2.0 / grid;
    let shift = cell * unit;

    var output: VertexOutput;
    output.pos = vec4f(corner_pos + shift, 0, 1);
    output.cell = cell;
    return output;
}
