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

let createSlider = function(configName) {
  let ret = new Gtk.Scale({digits: 0, sensitive: true, orientation: Gtk.Orientation.HORIZONTAL, margin_right: 6, margin_left: 6});
  ret.set_range(0, 100);
  ret.set_value(Utils.getNumber(configName, 50));
  ret.set_value_pos(Gtk.PositionType.RIGHT);
  ret.connect("value-changed", function(obj, userData) {
    Utils.setParameter(configName, obj.get_value());
  });
  return ret;
}


const PutWindowSettingsWidget = new GObject.Class({
  Name: 'PutWindow.Prefs.PutWindowSettingsWidget',
  GTypeName: 'PutWindowSettingsWidget',
  Extends: Gtk.Notebook,

  _init : function(params) {
    this.parent(params);
    this.orientation = Gtk.Orientation.VERTICAL;
    this.hexpand = true;
    this._wnckScreen = Wnck.Screen.get_default();

    this.append_page(this._createKeyboardConfig(), new Gtk.Label({label: "<b>Keyboard Shortcuts</b>",
         halign:Gtk.Align.START, margin_left: 4, use_markup: true}));

   },

  _createCornerChangesCombo: function() {
    this._model = new Gtk.ListStore();
    this._model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    let combo = new Gtk.ComboBox({ model: this._model, halign: Gtk.Align.END});

    let currentValue = Utils.getNumber(Utils.CORNER_CHANGE, 0);

    let values = [
      ["0", "Both"],
      ["1", "Only height"],
      ["2", "Only width"],
      ["3", "Never change size"],
      ["4", "Nothing on first move, both on second"],
      ["5", "Nothing on first move, Only height on second"],
      ["6", "Nothing on first move, Only width on second"]
    ]
    let selectMe = null;
    for (let i=0; i< values.length; i++) {
      let iter = this._model.append();
      this._model.set(iter, [0, 1], values[i]);
      if (values[i][0] == currentValue) {
        selectMe = iter;
      }
    }

    if (selectMe != null) {
      combo.set_active_iter(selectMe);
    }

    let renderer = new Gtk.CellRendererText();
    combo.pack_start(renderer, true);
    combo.add_attribute(renderer, 'text', 1);
    combo.connect("changed", Lang.bind(this,
      function(obj) {
        let[success, iter] = obj.get_active_iter();
        if (!success) {
          return;
        }
        Utils.setParameter(Utils.CORNER_CHANGE, this._model.get_value(iter, 0));
      })
    );
    return combo;
  },

  _addSliders: function(grid, row, labels, configName) {
    for (let i=0; i < labels.length; i++) {
      row++;
      grid.attach(new Gtk.Label({label: labels[i], halign:Gtk.Align.START, margin_left: 15 }), 0, row, 1, 1);
      grid.attach(createSlider(configName + "-" + i), 1, row, 5, 1);
    }
    return row;
  },

  _createKeyboardConfig: function() {
    return this._createBindingList({
        "maximize": "Maximize with aspect ratio",
        "restore": "Restore window",
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
    let widget = new PutWindowSettingsWidget();
    widget.show_all();
    return widget;
};
