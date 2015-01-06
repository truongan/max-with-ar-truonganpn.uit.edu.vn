
const St = imports.gi.St;

const Tweener = imports.ui.tweener;


const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.utils;


/**
 * Thanks to:
 * gcampax for auto-move-window extension and
 * vibou_ for gtile and his getInner/OuterPadding that is used in nearly every
 *        extension that moves windows around
 * 73 for fixing overlapping windows issue and the idea and help for the
 *    "Move Focus" feature.
 *
 * Believe in the force! Read the source!
 **/
function MoveWindow() {
	this._init();
};

function _hideHello() {
    Main.uiGroup.remove_actor(text);
    text = null;
}
function dump(arr,level) {
	var dumped_text = "";
	if(!level) level = 0;
	
	//The padding given at the beginning of the line.
	var level_padding = "";
	for(var j=0;j<level+1;j++) level_padding += ".\t";
	
	if(typeof(arr) == 'object') { //Array/Hashes/Objects 
		for(var item in arr) {
			var value = arr[item];
			
			if(typeof(value) == 'object') { //If it is an array,
				dumped_text += level_padding + "'" + item + "' ...\n";
				dumped_text += dump(value,level+1);
			} else {
				dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
			}
		}
	} else { //Stings/Chars/Numbers etc.
		dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
	}
	return dumped_text;
}


MoveWindow.prototype = {

	_utils: {},

	// private variables
	_bindings: [],
	_padding: 2,

	_primary: 0,

	_screens: [],

	/**
	 * Helper functions to set custom handler for keybindings
	 */
	_addKeyBinding: function(key, handler) {
		this._bindings.push(key);
		//log('key + handler ' + dump(key) + "\n" + dump(handler));

		if (Main.wm.addKeybinding && Shell.KeyBindingMode) { // introduced in 3.7.5
			// Shell.KeyBindingMode.NORMAL | Shell.KeyBindingMode.MESSAGE_TRAY,
			Main.wm.addKeybinding(key,
				this._utils.getSettingsObject(), Meta.KeyBindingFlags.NONE,
				Shell.KeyBindingMode.NORMAL,
				handler
			);
		} else {
			global.display.add_keybinding(
				key,
				this._utils.getSettingsObject(),
				Meta.KeyBindingFlags.NONE,
				handler
			);
		}
	},

	_getTopPanelHeight: function() {
		return Main.panel.actor.y + Main.panel.actor.height;
	},

	_recalculateSizes: function(s) {

		let tbHeight = s.primary ? this._getTopPanelHeight() : 0;
		if (Math.abs(tbHeight) <= 2) {
			tbHeight = 0;
		}
		s.y = s.geomY + tbHeight;

		tbHeight = tbHeight / 2;

		let i = 0;
		let widths = this._utils.getWestWidths();
		s.west = [];
		for ( i=0; i < widths.length; i++) {
			s.west[i] = {
				width: s.totalWidth * widths[i],
				x: s.x
			}
		}


		widths = this._utils.getEastWidths();
		s.east = [];
		for ( i=0; i < widths.length; i++) {
			s.east[i] = {
				width: s.totalWidth * widths[i],
				x: s.geomX + (s.totalWidth * (1 - widths[i]))
			}
		}

		let heights = this._utils.getNorthHeights();
		s.north = [];
		for ( i=0; i < heights.length; i++) {
			s.north[i] = {
				height: s.totalHeight * heights[i] - tbHeight,
				y: s.y
			}
		}

		heights = this._utils.getSouthHeights();
		s.south = [];
		for (i=0; i < heights.length; i++) {
			let h = s.totalHeight * heights[i] - tbHeight;
			s.south[i] = {
				height: h,
				y: s.totalHeight - h + s.geomY
			}
		}

		return s;
	},



		/**
	 * Checks the _screens array, and returns the index of the screen, the
	 * given window (win) is on
	 */
	_getCurrentScreenIndex: function(win) {

		// left edge is sometimes -1px...
		let pos = win.get_outer_rect();
		pos.x = pos.x < 0 ? 0 : pos.x;

		let sl = this._screens.length;
		for (let i=0; i<sl; i++) {
			if (i == sl-1) {
				return i;
			}
			if (this._screens[i].x <= pos.x && this._screens[(i+1)].x > pos.x) {
				return i;
			}
		}
		return this._primary;
	},


	_moveToCornerKeepSize: function(win, screenIndex, direction) {
		let s = this._screens[screenIndex];
		let pos = win.get_outer_rect();

		let x,y;

		if (direction.indexOf("s") == -1) {
			y = s.y;
		} else {
			y = (s.totalHeight - pos.height);
		}

		if (direction.indexOf("w") == -1) {
			x = s.x + (s.totalWidth - pos.width);
		} else {
			x = s.x;
		}

		// window is already in the given corner
		if (this._samePoint(pos.x, x) && this._samePoint(pos.y, y)) {
			return false;
		}

		if (win.decorated) {
			win.move_frame(true, x, y);
		} else {
			win.move(true, x, y);
		}
		return true;
	},
	
	maximize: function() {
		log("\n------- start max with ar ----- \n");
				
		let win = global.display.focus_window;
		if (win == null) {
			return;
		}

		let screenIndex = this._getCurrentScreenIndex(win);
		let s = this._screens[screenIndex];
		// check if we are on primary screen and if the main panel is visible
		s = this._recalculateSizes(s);

		let pos = win.get_outer_rect();

		let new_width = -1;
		let new_height = -1;
		let new_x = 0;
		let new_y = 0;
		let useIndex = 0, maximize_flags = 0;
		let sizes;
		
		//asume we maxiize to s.totalWidth, the corrospondent height will be:
		let max_height = s.totalWidth * pos.height / pos.width;

		log('old pos.width x height ', pos.height + ' x ' +  pos.width); 
		log( 's.east ', dump(s.east));
		log( 's.north ', dump(s.north));

		if (max_height > s.totalHeight - s.north[0].y) {
			//we can't afford max_height, maximize to totalHeight
			new_height = s.totalHeight - s.north[0].y;
			new_width = new_height * pos.width / pos.height;

			maximize_flags = maximize_flags | Meta.MaximizeFlags.VERTICAL; //maximize vertical only

			sizes = s.west;
			for ( let i=0; i < sizes.length; i++) {
				if (this._samePoint(pos.height, sizes[i].height) && this._samePoint(pos.y, sizes[i].y)) {
					useIndex = i + 1;
					if (useIndex >= sizes.length) {
						useIndex =  0;
					}
					break;
				}
			}

			//this._resize(win, sizes[useIndex].x, s.y, sizes[useIndex].width, s.totalHeight * -1);

			new_x = sizes[useIndex].x, new_y = s.y;
		} else {
			new_width = s.totalWidth ;
			new_height = max_height;
			sizes = s.north;
			
			maximize_flags = maximize_flags | Meta.MaximizeFlags.HORIZONTAL;
			
			for ( let i=0; i < sizes.length; i++) {
				if (this._samePoint(pos.height, sizes[i].height) && this._samePoint(pos.y, sizes[i].y)) {
					useIndex = i + 1;
					if (useIndex >= sizes.length) {
						useIndex =  0;
					}
					break;
				}
			}

			if (new_height == sizes[useIndex].height) //if we got the max height, set max flags
				maximize_flags = maximize_flags | Meta.MaximizeFlags.VERTICAL;

			//this._resize(win, s.x, sizes[useIndex].y, s.totalWidth * -1, sizes[useIndex].height);
			new_x = s.x ; new_y = sizes[useIndex].y;
		}

		
		log('maximize_flags ', maximize_flags);
		log('new x,y ' + new_x + ', ' + new_y);
		log('new width x height ' + new_height + ' x ' + new_width);
		

		//this._resize(win, new_x, new_y, new_height, new_width);
	
		win.maximize(maximize_flags);
		
		// snap, x, y
		if (win.decorated) {
			win.move_frame(true, new_x, new_y);
		} else {
			win.move(true, new_x, new_y);
		}

		//let padding = this._getPadding(win);
		let padding = 0;
		// snap, width, height, force
		
		//win.resize(true, new_width - padding.width, new_height - padding.height);
		win.move_resize_frame(true, new_x, new_y, new_width, new_height);
		
		pos = win.get_outer_rect();
		log('new real pos.width x height ', pos.height + ' x ' +  pos.width); 

		if (!text) {
			text = new St.Label({ style_class: 'helloworld-label', text: "Maximize" });
			Main.uiGroup.add_actor(text);
		}

		text.opacity = 255;

		let monitor = Main.layoutManager.primaryMonitor;

		text.set_position(Math.floor(new_x + new_width / 2 - text.width / 2),
						  Math.floor(new_y + new_height / 2 - text.height / 2));

		Tweener.addTween(text,
					 { opacity: 0,
					   time: 2,
					   transition: 'easeOutQuad',
					   onComplete: _hideHello });
	},



	// On large screens the values used for moving/resizing windows, and the resulting
	// window.rect are may not be not equal (==)
	// --> Assume points are equal, if the difference is <= 40px
	// @return true, if the difference between p1 and p2 is less then 41
	_samePoint: function(p1, p2) {
		return (Math.abs(p1-p2) <= 40);
	},


	// the difference between input and outer rect as object.
	_getPadding: function(win) {
		let outer = win.get_outer_rect();
		let inner = win.get_rect();
		return {
			width: (outer.width - inner.width),
			height: (outer.height - inner.height)
		};
	},

	counter: 0,

	_loadScreenData: function() {
		// get monotor(s) geometry
		this._primary = global.screen.get_primary_monitor();
		let numMonitors = global.screen.get_n_monitors();

		this._screens = [];
		// only tested with 2 screen setup
		for (let i=0; i<numMonitors; i++) {
			let geom = global.screen.get_monitor_geometry(i);
			let primary = (i == this._primary);

			this._screens[i] =  {
				primary: primary,
				y: geom.y,
				x : geom.x,
				geomX: geom.x,
				geomY: geom.y,
				totalWidth: geom.width,
				totalHeight: geom.height,
				east: [],
				west: [],
				north: [],
				south: []
			};
		}
		// sort by x position. makes it easier to find the correct screen
		this._screens.sort(function(s1, s2) {
				return s1.x - s2.x;
		});
	},

	/**
	 * Get global.screen_width and global.screen_height and
	 * bind the keys
	 **/
	_init: function() {
		// read configuration and init the windowTracker

		this._utils = new Utils.Utils();
		this._windowTracker = Shell.WindowTracker.get_default();

		this._loadScreenData();

		this._screenListener = global.screen.connect("monitors-changed",
			Lang.bind(this, this._loadScreenData));

		this._bindings = [];

		this._addKeyBinding("maximize-ar",
			Lang.bind(this, function(){ this.maximize();})
		);

	},

	/**
	 * disconnect all keyboard bindings that were added with _addKeyBinding
	 **/
	destroy: function() {

		if (this._windowCreatedListener) {
			global.screen.get_display().disconnect(this._windowCreatedListener);
			this._windowCreatedListener = false;
		}

		if (this._screenListener) {
			global.screen.disconnect(this._screenListener);
			this._screenListener = false;
		}

		let size = this._bindings.length;

		for(let i = 0; i<size; i++) {
			if (Main.wm.removeKeybinding) {// introduced in 3.7.2
				Main.wm.removeKeybinding(this._bindings[i]);
			} else {
				global.display.remove_keybinding(this._bindings[i]);
			}
		}
		this._bindings = [];

		this._utils.destroy();

	}
}
let text, mw;

function init(meta) {

};
	//Extension.stateObj._moveWindow.maximize();

function enable() {
	this._moveWindow = new MoveWindow();
};

function disable(){
	this._moveWindow.destroy();
	//Main.panel._leftBox.remove_child(button);
};
