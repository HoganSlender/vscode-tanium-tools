# HoganSlender's Tanium Tools

Contains miscellaneous commands to work with Tanium servers in Visual Studio Code.

## Features
* **Available Commands**
    * `Tanium: Compare Content Set` - allows you to download a content set xml file from Tanium support and compare it to the sensors on your server.    
    * `Tanium: Compare Tanium Server Sensors` - allows you to compare sensors from 2 different Tanium servers.
    * `Tanium: Retrieve Sensor Data by Name` - allows you to retrieve a sensor by name from the Tanium server.
    * `Tanium: Retrieve Sensor Data by Hash` - allows you to retrieve a sensor by hash value from the Tanium server.
* **Available Settings**
    * `hoganslender.tanium.allowSelfSignedCerts` - Set to true if communicating with servers that are using a self signed certificate.
    * `hoganslender.tanium.fqdns` - List of recently used Tanium server FQDNs.
    * `hoganslender.tanium.httpTimeoutSeconds` - Number of seconds for HTTP request timeout.
    * `hoganslender.tanium.signingPaths` - Path definitions for KeyUtility.exe and private key file
    * `hoganslender.tanium.usernames` - List of recently used Tanium usernames.
* **Available Context Menus**
    * **Visual Studio Code Explorer**
        * **Folders**
            * `Tanium: Generate Export File for Missing Sensors` - Generates an export file that contains the missing sensors from the right side of the two selected folders.
            * `Tanium: Generate Export File for Modified Sensors` - Generates an export file that contains the modified sensors from the two selected folders.
        * **Files**
            * `Tanium: Sign Content` - Signs the selected file for importing into Tanium server.
## Known Issues
* none
## Release Notes
### 0.0.3
* Removed `Tanium: Sign Content` and `Tanium: Generate Export File for Missing Sensors` from command palette since they are context menu driven
### 0.0.2
* Moved Release notes from README to CHANGELOG
### 0.0.1
* Release of `Tanium: Compare Content Set` command
* Release of `Tanium: Compare Tanium Server Sensors` command
* Release of `Tanium: Sign Content` context menu
* Release of `Tanium: Generate Export File for Missing Sensors` context menu
## Recommended Extensions
- [Diff Folders](https://marketplace.visualstudio.com/items?itemName=L13RARY.l13-diff) - Extremely useful in comparing Tanium content