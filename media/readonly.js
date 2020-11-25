const vscode = acquireVsCodeApi();

var lItems = document.getElementById("litems");

lItems.addEventListener("dblclick", () => openDiff(lItems));

function openDiff(from) {
    console.log('inside openDiff');
    if (from.selectedIndex === -1) {
        return;
    }

    var o = from.options[from.selectedIndex];

    // send message
    vscode.postMessage({
        command: 'openDiff',
        name: o.text,
        path: o.value,
    });
}