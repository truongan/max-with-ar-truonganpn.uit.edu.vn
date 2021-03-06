const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;

const Gdk = imports.gi.Gdk;
const Wnck = imports.gi.Wnck;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = new Me.imports.utils.Utils();

const Lang = imports.lang;
const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;


const temporary_widget_settings = new GObject.Class({
	Name: 'PutWindow.Prefs.temporary_widget_settings',
	GTypeName: 'temporary_widget_settings',
	Extends: Gtk.Notebook,

	_init : function(params) {
		this.parent(params);
		this.orientation = Gtk.Orientation.VERTICAL;
		this.hexpand = true;
		this._wnckScreen = Wnck.Screen.get_default();

		this.append_page(this._createKeyboardConfig(), new Gtk.Label({label: "<b>Keyboard Shortcuts</b>",
				 halign:Gtk.Align.START, margin_left: 4, use_markup: true}));

	 },


	_createKeyboardConfig: function() {
		return this._createBindingList({
				"maximize-ar": "Maximize with aspect ratio"
		});
	},

	_createBindingList: function(bindings) {

		let name, model = new Gtk.ListStore();

		model.set_column_types([
			GObject.TYPE_STRING,
			GObject.TYPE_STRING,
			GObject.TYPE_INT,
			GObject.TYPE_INT
		]);

		for (name in bindings) {
			let [key, mods] = Gtk.accelerator_parse(Utils.get_strv(name, null)[0]);
			let row = model.insert(10);
			model.set(row, [0, 1, 2, 3], [name, bindings[name], mods, key ]);
		}

		let treeview = new Gtk.TreeView({
			'expand': true,
			'model': model,
			margin: 4
		});

		// Action column
		let cellrend = new Gtk.CellRendererText();
		let col = new Gtk.TreeViewColumn({ 'title': 'Action', 'expand': true });
		col.pack_start(cellrend, true);
		col.add_attribute(cellrend, 'text', 1);
		treeview.append_column(col);

		// keybinding column
		cellrend = new Gtk.CellRendererAccel({
			'editable': true,
			'accel-mode': Gtk.CellRendererAccelMode.GTK
		});

		cellrend.connect('accel-edited', function(rend, iter, key, mods) {
			let value = Gtk.accelerator_name(key, mods);
			let [succ, iterator ] = model.get_iter_from_string(iter);

			if(!succ) {
				throw new Error("Error updating Keybinding");
			}

			let name = model.get_value(iterator, 0);

			model.set(iterator, [ 2, 3], [ mods, key ]);
			Utils.set_strv(name, [value]);
		});

		col = new Gtk.TreeViewColumn({'title': 'Modify'});

		col.pack_end(cellrend, false);
		col.add_attribute(cellrend, 'accel-mods', 2);
		col.add_attribute(cellrend, 'accel-key', 3);

		treeview.append_column(col);

		return treeview;
	}


});

function init() {

}

function buildPrefsWidget() {
	let widget = new temporary_widget_settings();
	widget.show_all();
	return widget;
};
