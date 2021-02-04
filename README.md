Gives more control over the RPG Maker AI, by allowing dynamic adjustments to action list ratings and target TGR.

Please see the plugin files themselves for the most up-to-date documentation.

## Installation

`LWP_AiAdjustment.js` from this repo and put it in your RPG Maker js/plugins folder.

Add `LWP_AiAdjustment.js` to your plugins in RPG Maker. It's probably not important
where in the plugin list it is put; there are currently no known conflicts with other
plugins.

Read the documentation in `LWP_AiAdjustment.js`.

## Demo project installation

* Create a new project in RPG Maker MZ. 
* Download `TestProject.zip`.
* Unzip `TestProject.zip` inside the new project. It should overwrite the data and js folders.

### Installing in RPG Maker MV

* Create a new project in RPG Maker MV. 
* Download `TestProject.zip`.
* Open `TestProject.zip` and copy only the following files, overwriting the ones in the new project if there are conflicts:
    * The `js` folder
	* The following files in the `data` folder:
	    * Enemies.json
		* Map001.json
		* Skills.json
		* States.json
		* Troops.json
* Re-open the project in RPG Maker MV, and make the following changes:
    * Give the enemies pictures. Choose any pictures you like.
	* Find the "Explode" skill (id: 42) and set its "scope" to "all enemies" (the "everyone" scope it uses in RMMZ doesn't exist in RMMV).

