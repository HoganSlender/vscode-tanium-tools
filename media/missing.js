const vscode = acquireVsCodeApi();

console.log('missing');

var missingAddButton = document.getElementById("missingAddButton");
var missingRemoveButton = document.getElementById("missingRemoveButton");
var processMissingButton = document.getElementById("processMissingButton");

if (processMissingButton !== null) {
    console.log(`processMissingButtons !== null`);
    processMissingButton.disabled = true;
} else {
    console.log(`processMissingButtons === null`);
}

var missinglItems = document.getElementById("missinglitems");
var missingrItems = document.getElementById("missingritems");

if (missinglItems !== null) {
    console.log(`missinglItems !== null`);
    missinglItems.addEventListener("dblclick", () => openFile(missinglItems));
} else {
    console.log(`missinglItems === null`);
}

if (missingrItems !== null) {
    console.log(`missingrItems !== null`);
    missingrItems.addEventListener("dblclick", () => openFile(missingrItems));
} else {
    console.log(`missingrItems === null`);
}

var divShowServerInfo = document.getElementById('divShowServerInfo');

if (divShowServerInfo !== null) {
    console.log(`divShowServerInfo !== null`);    
} else {
    console.log(`divShowServerInfo === null`);    
}

var showServerInfo = divShowServerInfo.innerHTML === '1';
var serverInfo = document.getElementById('serverInfo');

var divTransferIndividual = document.getElementById('divTransferIndividual');
var transferIndividual = divTransferIndividual.innerHTML === '1';
console.log(`transferIndividual: ${transferIndividual}`);

if (missingAddButton !== null) {
    console.log(`missingAddButton !== null`);
    missingAddButton.addEventListener("click", () => addButtonEvent(missinglItems, missingrItems));
} else {
    console.log(`missingAddButton === null`);
}

if (missingRemoveButton !== null) {
    console.log(`missingRemoveButton !== null`);
    missingRemoveButton.addEventListener("click", () => removeButtonEvent(missingrItems, missinglItems));
} else {
    console.log(`missingRemoveButton === null`);
}

if (processMissingButton !== null) {
    console.log(`processMissingButton !== null`);
    processMissingButton.addEventListener("click", processMissingItems);
} else {
    console.log(`processMissingButton === null`);
}

var divFqdns = document.getElementById("divFqdns");
var divUsernames = document.getElementById("divUsernames");
var divSigningKeys = document.getElementById("divSigningKeys");

if (!showServerInfo) {
    console.log(`showServerInfo === false`);
    serverInfo.style.visibility = 'hidden';
} else {
    console.log(`showServerInfo === true`);
    var divMissingSourceFqdn = document.getElementById("divMissingSourceFqdn");
    var divMissingDestFqdn = document.getElementById("divMissingDestFqdn");
    var divMissingUsername = document.getElementById("divMissingUsername");
    var divMissingSigningKey = document.getElementById("divMissingSigningKey");

    var fqdnsText = divFqdns.innerHTML;

    var fqdns = fqdnsText.split(',');

    var usernamesText = divUsernames.innerHTML;

    var usernames = usernamesText.split(',');

    var signingKeysText = divSigningKeys.innerHTML;

    var signingKeys = signingKeysText.split(',');

    if (divMissingSourceFqdn !== null) {
        processInput(fqdns, divMissingSourceFqdn, 'taniumSourceServerFqdnSelect', false);
    }

    processInput(fqdns, divMissingDestFqdn, 'taniumDestServerFqdnSelect', true);
    processInput(usernames, divMissingUsername, 'taniumServerUsernameSelect', true);
    
    if (divMissingSigningKey !== null) {
        processInput(signingKeys, divMissingSigningKey, 'taniumSigningKeySelect', true);
    }

    var missingTaniumServerPassword = document.getElementById("missingTaniumServerPassword");

    var taniumSourceServerFqdnSelect = document.getElementById("taniumSourceServerFqdnSelect");
    var taniumDestServerFqdnSelect = document.getElementById("taniumDestServerFqdnSelect");
    var taniumServerUsernameSelect = document.getElementById("taniumServerUsernameSelect");
    var taniumSigningKeySelect = document.getElementById("taniumSigningKeySelect");

    missingTaniumServerPassword.addEventListener("input", enableProcessPackage);
}

// handle messages from extension to webview
window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'complete':
            // remove first item
            missingrItems.options[0] = null;

            processMissingItems();
            break;
    }
});

function processInput(inputArray, targetDiv, targetId, isLast) {
    var tag = document.createElement("select");
    tag.setAttribute("id", `${targetId}`);
    targetDiv.appendChild(tag);

    for (var i = 0; i < inputArray.length; i++) {
        var item = inputArray[i];
        var option = document.createElement("option");
        option.setAttribute("value", item);
        var text = document.createTextNode(item);
        option.appendChild(text);
        tag.appendChild(option);
    }

    // set selected index
    if (isLast) {
        tag.selectedIndex = inputArray.length - 1;
    }
}

function enableProcessPackage() {
    if (showServerInfo) {
        processMissingButton.disabled = missingTaniumServerPassword.value.trim().length === 0;
    } else {
        processMissingButton.disabled = missingrItems.options.length === 0;
    }
}

function addButtonEvent(from, to) {
    moveItems(from, to);
    if (!showServerInfo) {
        enableProcessPackage();
    }
}

function removeButtonEvent(from, to) {
    moveItems(from, to);
    if (!showServerInfo) {
        enableProcessPackage();
    }
}

function moveItems(from, to) {
    if (from.selectedIndex === -1) {
        return;
    }

    for (var i = 0; i < from.options.length; i++) {
        var o = from.options[i];

        if (o.selected) {
            to.options[to.options.length] = new Option(o.text, o.value);
        }
    }

    for (var i = from.options.length - 1; i >= 0; i--) {
        var o = from.options[i];

        if (o.selected) {
            from.options[i] = null;
        }
    }
}

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

function openFile(from) {
    console.log('inside openFile');
    if (from.selectedIndex === -1) {
        return;
    }

    var o = from.options[from.selectedIndex];
    console.log(`filePath: ${o.value}`);

    // send message
    vscode.postMessage({
        command: 'openFile',
        path: o.value,
    });
}

function processMissingItems() {
    console.log('inside processMissingItems');
    processMissingButton.disabled = true;

    const sourceFqdn = taniumSourceServerFqdnSelect?.value ?? '';
    console.log(`sourceFqdn: ${sourceFqdn}`);
    const destFqdn = taniumDestServerFqdnSelect?.value ?? '';
    console.log(`destFqdn: ${destFqdn}`);
    const username = taniumServerUsernameSelect?.value ?? '';
    console.log(`username: ${username}`);
    const signingKey = taniumSigningKeySelect?.value ?? '';
    console.log(`signingKey: ${signingKey}`);

    if (transferIndividual) {
        console.log('transfer individual');
        // process first item
        if (missingrItems.options.length !== 0) {
            var option = missingrItems.options[0];

            // send message
            vscode.postMessage({
                command: 'transferItem',
                sourceFqdn: sourceFqdn,
                destFqdn: destFqdn,
                username: username,
                password: missingTaniumServerPassword.value,
                path: option.value,
                name: option.text,
                signingServerLabel: signingKey,
            });
        } else {
            vscode.postMessage({
                command: 'completeProcess'
            });
            processMissingButton.disabled = false;
        }
    } else {
        console.log('transfer all');
        // gather all values and send
        if (missingrItems.options.length !== 0) {
            var items = [];
            for (var i = 0; i < missingrItems.options.length; i++) {
                var o = missingrItems.options[i];
                items.push({
                    path: o.value,
                    name: o.text,
                });
            }

            console.log(`items: ${JSON.stringify(items, null, 2)}`);

            // send message
            vscode.postMessage({
                command: 'transferItems',
                items: items,
            });
            processMissingButton.disabled = false;
        }
    }
}