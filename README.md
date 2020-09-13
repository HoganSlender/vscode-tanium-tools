# HoganSlender's Tanium Tools

Contains miscellaneous commands to work with Tanium servers in Visual Studio Code.

## Features
* **Available Commands**
    * `Tanium: Compare Content Set` - allows you to download a content set xml file from Tanium support and compare it to the sensors on your server.    
    * `Tanium: Compare Tanium Server Sensors` - allows you to compare sensors from 2 different Tanium servers.
* **Available Settings**
    * `hoganslender.tanium.httpTimeoutSeconds` - Number of seconds for HTTP request timeout.
    * `hoganslender.tanium.fqdns` - List of recently used Tanium server FQDNs.
    * `hoganslender.tanium.usernames` - List of recentrly used Tanium usernames.
* **Available Context Menus**
    * **Visual Studio Code Explorer**
        * **Folders**
            * `Tanium: Generate Export File for Missing Sensors` - Generates an export file that contains the missing sensors from the right side of the two selected folders.
        * ****Files****
            * `Tanium: Sign Content` - Signs the selected file for importing into Tanium server.
## Known Issues
* none
## Release Notes
### 0.0.1
Initial release of `Tanium: Compare Content Set` command
Initial release of `Tanium: Compare Tanium Server Sensors` command
## Recommended Extensions
- [Diff Folders](https://marketplace.visualstudio.com/items?itemName=L13RARY.l13-diff) - Extremely useful in comparing Tanium content