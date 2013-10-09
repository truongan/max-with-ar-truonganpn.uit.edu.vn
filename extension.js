
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


	/**
	 * Moves win, that is currently on screen[screenIndex] in the given direction.
	 * Depending on ALWAYS_USE_WIDTHS config and screen setup, the window is either
	 * moved to other screen or only resized.
	 *
	 * @param win The window that must be moved
	 * @param screenIndex The screen the window belongs to (this._screens)
	 * @param direction The two available sides e/w (i.e. east/west)
	 */
	_moveToSide: function(win, screenIndex, direction) {

		let s = this._screens[screenIndex];
		let pos = win.get_outer_rect();
		let sizes = direction == "e" ? s.east : s.west;

		if (win.maximized_horizontally && this._utils.getBoolean(this._utils.INTELLIGENT_CORNER_MOVEMENT, false)) {
			// currently at the left side (WEST)
			if (pos.y == s.y) {
				this._moveToCorner(win, screenIndex, "n" + direction, false, true, true);
			} else {
				this._moveToCorner(win, screenIndex, "s" + direction, false, true, true);
			}
			return;
		}

		let useIndex = 0;
		for ( let i=0; i < sizes.length; i++) {
			if (this._samePoint(pos.width, sizes[i].width) && this._samePoint(pos.x, sizes[i].x)) {
				useIndex = i + 1;
				if (useIndex >= sizes.length) {
					useIndex =  0;
				}
				break;
			}
		}

		let otherDirection = "e";
		let canMoveScreen = screenIndex > 0;
		if (direction == "e") {
			otherDirection = "w";
			canMoveScreen = screenIndex < (this._screens.length - 1);
		}

		if (useIndex > 0 && canMoveScreen && !this._utils.getBoolean(this._utils.ALWAYS_USE_WIDTHS)) {
			// moved in this direction more then once, if a screen exists, move the window there
			if (useIndex > 1) {
				// the window was moved here from an other screen, just resize it
				useIndex = 0;
			} else {
				// moving to other screen is possible, move to screen and resize afterwards
				this._moveToScreen(direction);
				this._moveFocused(otherDirection);
				return;
			}
		}

		this._resize(win, sizes[useIndex].x, s.y, sizes[useIndex].width, s.totalHeight * -1);
	},

	_moveNorthSouth: function(win, screenIndex, direction) {
		let s = this._screens[screenIndex];
		let pos = win.get_outer_rect();
		let sizes = direction == "n" ? s.north : s.south;

		if ( win.maximized_vertically && this._utils.getBoolean(this._utils.INTELLIGENT_CORNER_MOVEMENT, false)) {
			// currently at the left side (WEST)
			if (pos.x == s.x) {
				this._moveToCorner(win, screenIndex, "w" + direction, true, false, true);
			} else {
				this._moveToCorner(win, screenIndex, "e" + direction, true, false, true);
			}
			return;
		}

		let useIndex = 0;
		for ( let i=0; i < sizes.length; i++) {
			if (this._samePoint(pos.height, sizes[i].height) && this._samePoint(pos.y, sizes[i].y)) {
				useIndex = i + 1;
				if (useIndex >= sizes.length) {
					useIndex =  0;
				}
				break;
			}
		}

		if (this._utils.getBoolean(this._utils.CENTER_KEEP_WIDTH, false) && this._isCenterWidth(screenIndex, pos)) {
			this._resize(win, pos.x, sizes[useIndex].y, pos.width, sizes[useIndex].height);
			return;
		}

		this._resize(win, s.x, sizes[useIndex].y, s.totalWidth * -1, sizes[useIndex].height);
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

	/**
	 * move the current focused window into the given direction (c, n,e,s,w, ne, nw, sw, so)
	 */
	_moveFocused: function(where) {
		let win = global.display.focus_window;
		if (win == null) {
			return;
		}

		let screenIndex = this._getCurrentScreenIndex(win);
		let s = this._screens[screenIndex];
		// check if we are on primary screen and if the main panel is visible
		s = this._recalculateSizes(s);

		if (where == "c") {
			let pos = win.get_outer_rect();
			let w = s.totalWidth * (this._utils.getNumber(this._utils.CENTER_WIDTH, 50) / 100),
				h = s.totalHeight * (this._utils.getNumber(this._utils.CENTER_HEIGHT, 50) / 100),
				x = s.x + (s.totalWidth - w) / 2,
				y = s.y + (s.totalHeight - h) / 2,
				sameHeight = this._samePoint(h, pos.height);

			if (this._utils.getBoolean(this._utils.REVERSE_MOVE_CENTER, false)) {
				if (win.maximized_horizontally && win.maximized_vertically) {
					this._resize(win, x, y, w, h);
				} else {
					this._resize(win, s.x, s.y, s.totalWidth * -1, s.totalHeight * -1);
				}
			} else {
				// do not check window.width. until i find get_size_hint(), or min_width..
				// windows that have a min_width < our width will not be maximized (evolution for example)
				if (this._samePoint(x, pos.x) && this._samePoint(y, pos.y) && sameHeight) {
					// the window is alread centered -> maximize
					this._resize(win, s.x, s.y, s.totalWidth * -1, s.totalHeight * -1);
				} else {
					// the window is not centered -> resize
					this._resize(win, x, y, w, h);
				}
			}
		} else if (where == "n" || where == "s") {
			this._moveNorthSouth(win, screenIndex, where);
		} else if (where == "e" || where == "w") {
			this._moveToSide(win, screenIndex, where);
		} else {
			this._moveToCorner(win, screenIndex, where);
		}
	},

	maximize: function() {
		if (!text) {
			text = new St.Label({ style_class: 'helloworld-label', text: "Hello, world!" });
			Main.uiGroup.add_actor(text);
		}

		text.opacity = 255;

		let monitor = Main.layoutManager.primaryMonitor;

		text.set_position(Math.floor(monitor.width / 2 - text.width / 2),
						  Math.floor(monitor.height / 2 - text.height / 2));

		Tweener.addTween(text,
					 { opacity: 0,
					   time: 2,
					   transition: 'easeOutQuad',
					   onComplete: _hideHello });
		
		let win = global.display.focus_window;
		if (win == null) {
			return;
		}

		let screenIndex = this._getCurrentScreenIndex(win);
		let s = this._screens[screenIndex];
		// check if we are on primary screen and if the main panel is visible
		s = this._recalculateSizes(s);

		let pos = win.get_outer_rect();


		//this._resize(win, s.x, sizes[useIndex].y, s.totalWidth * -1, sizes[useIndex].height);

		/*	Move to side code
				this._resize(win, sizes[useIndex].x, s.y
				, sizes[useIndex].width
				, s.totalHeight * -1);
		*/

		let new_width = -1;
		let new_height = -1;
		let size;
		//asume we maxiize to s.totalWidth, the corrospondent height will be:
		let max_height = s.totalWidth * pos.height / pos.width;

		if (max_height > s.totalHeight) {
			//we can afford max_height, maximize to totalHeight
			new_width = s.totalHeight * pos.width / pos.height;
			new_height = s.totalHeight;
			sizes = s.east;
		} else {
			new_width = s.totalWidth;
			new_height = max_height;
			sizes = s.north;
		}

		let useIndex = 0;
		for ( let i=0; i < sizes.length; i++) {
			if (this._samePoint(pos.height, sizes[i].height) && this._samePoint(pos.y, sizes[i].y)) {
				useIndex = i + 1;
				if (useIndex >= sizes.length) {
					useIndex =  0;
				}
				break;
			}
		}

		this._resize(win, s.x, sizes[useIndex].y, new_height, new_width);

	},



	// On large screens the values used for moving/resizing windows, and the resulting
	// window.rect are may not be not equal (==)
	// --> Assume points are equal, if the difference is <= 40px
	// @return true, if the difference between p1 and p2 is less then 41
	_samePoint: function(p1, p2) {
		return (Math.abs(p1-p2) <= 40);
	},

	// actual resizing
	_resize: function(win, x, y, width, height) {
		let maximizeFlags = 0;
		let unMaximizeFlags = 0;
		if (height < 0) {
			maximizeFlags = maximizeFlags | Meta.MaximizeFlags.VERTICAL;
			height = 400; // dont resize to width, -1
		} else {
			unMaximizeFlags = unMaximizeFlags | Meta.MaximizeFlags.VERTICAL;
		}

		if (width < 0) {
			maximizeFlags = maximizeFlags | Meta.MaximizeFlags.HORIZONTAL;
			width = 400;  // dont resize to height, -1
		} else {
			unMaximizeFlags = unMaximizeFlags | Meta.MaximizeFlags.HORIZONTAL;
		}

		if (maximizeFlags != 0) {
			win.maximize(maximizeFlags);
		}
		if (unMaximizeFlags != 0) {
			win.unmaximize(unMaximizeFlags)
		}

		// snap, x, y
		if (win.decorated) {
			win.move_frame(true, x, y);
		} else {
			win.move(true, x, y);
		}

		let padding = this._getPadding(win);
		// snap, width, height, force
		win.resize(true, width - padding.width, height - padding.height);
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

		this._addKeyBinding("maximize",
			Lang.bind(this, function(){ this.maxmize();})
		);



		// move to n, e, s an w
		// this._addKeyBinding("put-to-side-n",
		// 	Lang.bind(this, function(){ this._moveFocused("n");})
		// );
	 

		// // move to  nw, se, sw, nw
		// this._addKeyBinding("put-to-corner-ne",
		// 	Lang.bind(this, function(){ this._moveFocused("ne");})
		// );
	 
		// // move to center. fix 2 screen setup and resize to 50% 50%
		// this._addKeyBinding("put-to-center",
		// 	Lang.bind(this, function(){ this._moveFocused("c");})
		// );

		// this._addKeyBinding("put-to-location",
		// 	Lang.bind(this, function() { this._moveToConfiguredLocation();} )
		// );

		// this._addKeyBinding("put-to-left-screen",
		// 	Lang.bind(this, function() { this._moveToScreen("left");} )
		// );

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
		if (this._moveFocusPlugin) {
			this._moveFocusPlugin.destroy();
		}
	}
}
let text, button, mw;

function init(meta) {

};

function outside_max(){

//	this._moveWindow.destroy();	
//	this._moveWindow.destroy();
	//this._moveWindow.maximize();
	Extension.stateObj._moveWindow.maximize();

	if (!text) {
		text = new St.Label({ style_class: 'helloworld-label', text: "Hello, world!" });
		Main.uiGroup.add_actor(text);
	}

	text.opacity = 255;

	let monitor = Main.layoutManager.primaryMonitor;

	text.set_position(Math.floor(monitor.width / 2 - text.width / 2),
					  Math.floor(monitor.height / 2 - text.height / 2));

	Tweener.addTween(text,
				 { opacity: 0,
				   time: 2,
				   transition: 'easeOutQuad',
				   onComplete: _hideHello });
}

function enable() {
	this._moveWindow = new MoveWindow();

	button = new St.Bin({ style_class: 'panel-button',
					  reactive: true,
					  can_focus: true,
					  x_fill: true,
					  y_fill: false,
					  track_hover: true });
	let icon = new St.Icon({ icon_name: 'system-run-symbolic',
							 style_class: 'system-status-icon' });

	button.set_child(icon);
	button.connect('button-press-event', outside_max);
	Main.panel._leftBox.insert_child_at_index(button, 0);
};

function disable(){
	this._moveWindow.destroy();
	Main.panel._leftBox.remove_child(button);
};
