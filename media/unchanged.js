const vscode = acquireVsCodeApi();

console.log('unchanged');

var unchangedlItems = document.getElementById("unchangedlitems");

unchangedlItems.addEventListener("dblclick", () => openDiff(unchangedlItems));

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