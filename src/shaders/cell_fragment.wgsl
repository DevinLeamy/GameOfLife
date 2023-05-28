@group(0) @binding(0) var<uniform> grid: vec2f;

struct FragmentIn {
    @location(0) cell: vec2f
};

@fragment
fn fragmentMain(input: FragmentIn) -> @location(0) vec4f {
    let unit = 1.0 / grid;
    let coverage = input.cell * unit;
    return vec4f(coverage, 1 - coverage.y, 1);
}
