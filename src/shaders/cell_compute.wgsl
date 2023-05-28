@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage, read> cellStateIn: array<u32>;
// Explicitly state that the storage buffer is writable
@group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>;

struct ComputeInput {
    // (0, 0, 0) -> (7, 7, 0)
    @builtin(global_invocation_id) cell: vec3u
};

fn cellIndex(cell: vec2u) -> u32 {
    return (cell.y % u32(grid.y)) * u32(grid.x) + (cell.x % u32(grid.x));
}

fn cellValue(x: u32, y: u32) -> u32 {
    return cellStateIn[cellIndex(vec2u(x, y))];
}

fn newState(currentValue: u32, neighbours: u32) -> u32 {
    var newValue: u32 = 0;
    if (currentValue == 1 && (neighbours == 2 || neighbours == 3)) {
        newValue = 1;
    } else if (currentValue == 0 && neighbours == 3) {
        newValue = 1;
    }

    return newValue;
}

@compute 
@workgroup_size(8, 8) // work is done in (8 x 8 x 1) groups
fn computeMain(input: ComputeInput) {
    let cell = input.cell.xy;
    let index = cellIndex(cell);
    let currentValue = cellValue(cell.x, cell.y);
    let value = cellValue(cell.x + 1, cell.y + 1) + 
                cellValue(cell.x - 1, cell.y + 1) +
                cellValue(cell.x + 1, cell.y - 1) +
                cellValue(cell.x - 1, cell.y - 1) +
                cellValue(cell.x + 1, cell.y) +
                cellValue(cell.x - 1, cell.y) +
                cellValue(cell.x, cell.y + 1) +
                cellValue(cell.x, cell.y - 1); 

    
    cellStateOut[index] = newState(currentValue, value);
}
