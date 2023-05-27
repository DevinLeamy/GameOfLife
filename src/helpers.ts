async function fetchShaderFile(name: string): Promise<string> {
    const response = await fetch(`http://localhost:8080/src/shaders/${name}.wgsl`)
    if (!response.ok) {
        throw new Error(`Failed to fetch shader file: ${response.status} ${response.statusText}`)
    }
    return await response.text()
}

export { fetchShaderFile }
