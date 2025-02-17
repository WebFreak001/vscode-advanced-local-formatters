# VSCode Advanced Local Formatters

Lets users add formatters to VSCode that run locally defined scripts.

## Fork Information

This is a fork of JKillian's custom local formatters extension. This fork has the following differences:

- published to OpenVSX directly
- range formatting / "Format Selection" is supported automatically
- you can specify the working directory for the command
- the command is specified as string array, so you don't have to escape arguments yourself
- you can specify commands only matching certain platforms, so you can distribute workspace settings with your project for all operating systems (PR upstream made for this)

## Motivation

VSCode's formatter features lets you quickly format code through the Format Document command (`shift+alt+f`) or Format Selection command (`ctrl+k ctrl+f`)
or automatically on save with the `editor.formatOnSave` option.

However, the only way to add new formatters to VSCode is by installing an extension.
If you have custom formatting tools or scripts you want to run, there's no easy way to integrate them with VSCode currently.

This extension solves that problem by providing an easy way to register custom scripts as VSCode formatters.
Here's an example of a custom python script that sorts imports and reformats code being run on a python file:

![Extension in use](images/exampleUsecase.gif)


## Quickstart
0. Install this extension through the VSCode extensions panel or [VSCode extensions marketplace](https://marketplace.visualstudio.com/items?itemName=webfreak.advanced-local-formatters) or [OpenVSX marketplace](https://open-vsx.org/extension/webfreak/advanced-local-formatters).

1. Define your custom formatting script.
   Scripts will receive the contents of the file to be formatted over STDIN.
   They should output the formatted results over STDOUT.
  
2. Configure the extension to run your script on files of the right type.
   The script will be run with a working directory of the workspace root.
   Valid language identifiers [can be found here](https://code.visualstudio.com/docs/languages/identifiers) and will be auto-completed.

   ```json
     "advancedLocalFormatters.formatters": [
       {
         "command": ["python", "format-yml-files.py"],
         "languages": ["yml"]
       }
     ]
   ```

3. That's it! Your script is now integrated with VSCode as an official formatter.
   You can now format your code though the Format Document command (`shift+alt+f`), Format Selection command (`ctrl+k ctrl+f`), enable the `editor.formatOnSave` option, or use the formatter however else VSCode allows.

## Extension Settings

Full extension configuration schema and documentation can be found in the [`package.json`](package.json) file.

## Known Limitations

VSCode doesn't seem to provide a way to name the formatter which an extension creates.
This means that if you register multiple formatters for the same language,
they will unfortunately both show up as 'Advanced Local Formatters' and it will be difficult to tell them apart.
