@group(0) @binding(0) var<uniform> grid: vec2f;

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
    let i = f32(input.instance);
    let cell = vec2f(i % grid.x, floor(i / grid.y));
    let corner_pos = (input.pos + 1) / grid - 1;
    let unit = 2 / grid;
    let shift = cell * unit;

    var output: VertexOutput;
    output.pos = vec4f(corner_pos + shift, 0, 1);
    output.cell = cell;
    return output;
}
