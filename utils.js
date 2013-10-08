const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Me = imports.misc.extensionUtils.getCurrentExtension();

function Utils() {
  this._init();
}

Utils.prototype = {

  _filename: "",
  _settingsObject: { },
  _settings: "",

  _changeEventListeners: [],

  CENTER_WIDTH: "center-width",
  CENTER_HEIGHT: "center-height",
  CENTER_KEEP_WIDTH: "center-keep-width",
  ALWAYS_USE_WIDTHS: "always-use-widths",
  CORNER_CHANGE: "corner-changes",
  REVERSE_MOVE_CENTER: "reverse-move-center",

  MOVE_FOCUS_ENABLED: "move-focus-enabled",

  INTELLIGENT_CORNER_MOVEMENT: "intelligent-corner-movement",

  START_CONFIG: {
    autoMove: false,
    positions: [{
      x: 0,
      y: 0,
      width: 50,
      height: 100
    }]
  },

  _init: function() {
    this.loadSettings();

    // locations is a json strings stored in the gschema. -> reload it after the user saved his changes
    this._changeEventListeners.push({
      name: "locations",
      fn:  Lang.bind(this, this.loadSettings)
    });

    for (let i=0; i < this._changeEventListeners.length; i++) {
      this._changeEventListeners[i].handlerId = this._settingsObject.connect(
        'changed::' + this._changeEventListeners[i].name ,
        this._changeEventListeners[i].fn
      );
    }

  },

  destroy: function() {
    for (let i=0; i < this._changeEventListeners.length; i++) {
      this._settingsObject.disconnect(this._changeEventListeners[i].handlerId);
    }
  },

  getSettingsObject: function() {
    return this._settingsObject;
  },

  loadSettings: function() {
    let schema = Me.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    let schemaDir = Me.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
      schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
    } else {
      schemaSource = GioSSS.get_default();
    }

    schema = schemaSource.lookup(schema, true);
    if (!schema) {
        throw new Error('Schema ' + schema + ' could not be found for extension '
                        + Me.metadata.uuid + '. Please check your installation.');
    }

    this._settingsObject = new Gio.Settings({ settings_schema: schema });
    this._settings = {

    };
  },

  saveSettings: function() {
    try {
     
      // sometimes the shell hangs after the gtk messagebox is displayed :(
      // this.showMessage("Success!", "Changes successfully saved");
    } catch (e) {
      this.showErrorMessage("Error saving settings ", e);
    }
  },
  
  _addToArray: function(array, value) {
    if (array.indexOf(value) == -1) {
      array.push(value);
    }
    return array;
  },

  getBoolean: function(name, defaultValue) {
    let ret = defaultValue;
    if (name.indexOf("locations") == -1) {
      ret = this._settingsObject.get_int(name);
    } else {
      ret = this.getParameter(name);
    }
    return ret == "true" || ret == "1";
  },

  getNumber: function(name, defaultValue) {
    if (name.indexOf("locations") == -1) {
      return this._settingsObject.get_int(name);
    }

    return this._toNumber(this.getParameter(name, defaultValue), defaultValue);
  },

  get_strv: function(name) {
    return this._settingsObject.get_strv(name);
  },

  set_strv: function(name, value) {
    this._settingsObject.set_strv(name, value);
  },

  getParameter: function(name, defaultValue) {
    try {
      let path = name.split("."),
      value = this._settings[path[0]],
      pathLength = path.length;
      for (let i=1; i < pathLength; i++) {
        value = value[path[i]];
      }

      return value;
    } catch (e) {
      this.showErrorMessage("Error getting parameter!", "Can not get config by name " + name + " defaulting to " + defaultValue + "'" + e.message);
      return defaultValue;
    }
  },

  unsetParameter: function(name) {
    let path = name.split("."),
      conf = this._settings[path[0]],
      pathLength = path.length - 1;

    for (let i=1; i < pathLength; i++) {
      conf = conf[path[i]];
    }

    if (isNaN(path[pathLength])) {
      // normal object
      delete conf[ path[pathLength] ];
    } else {
      // an array
      conf.pop(path[pathLength]);
    }
  },

  setParameter: function(name, value) {
    try {
      if (name.indexOf("locations") == -1) {
        if (isNaN(value)) {
          this._settingsObject.set_string(name, value);
        } else {
          this._settingsObject.set_int(name, value);
        }
        return;
      }

      let path = name.split("."),
        conf = this._settings,
        pathLength = path.length - 1;

      for (let i=0; i < pathLength; i++) {
        if (!conf[path[i]]) {
          conf[path[i]] = {};
        }
        conf = conf[path[i]];
      }

      conf[ path[pathLength] ] = value;

    } catch (e) {
      this.showErrorMessage("Error setting parameter!", "Can not set config parameter " + name + " " + e.message);
    }
  },

  _toNumber: function(value, defaultValue) {
    let valueType = typeof(value);

    if (valueType == "undefined") {
      return defaultValue;
    }

    if (isNaN(defaultValue)) {
      defaultValue = 0;
    }

    return !isNaN(value)
      ? new Number(value)
      : defaultValue;
  },

  showMessage: function(title, message) {
    var md = new Gtk.MessageDialog({
      modal:true,
      message_type: Gtk.MessageType.INFO,
      buttons:Gtk. ButtonsType.OK,
      title: title,
      text: " " + message
    });

    md.run();
    md.destroy();
  },

  showErrorMessage: function(title, message) {
    global.log("ERROR: " + title + " " + message);
    //throw new Error(title + ' ' message);
  }
};
