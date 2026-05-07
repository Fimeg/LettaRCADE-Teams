export function handleCliError(error, jsonMode) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
        console.error(JSON.stringify({ error: message }));
    }
    else {
        console.error(`Error: ${message}`);
    }
    process.exit(1);
}
