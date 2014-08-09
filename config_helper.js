// config_setup.js
// small utility to help setup a config file.  It 
//  - reads a config file from disk
//  - asks the user a set of interactive questions to create new config file


(function(){

  // 
  var print = function(s){ process.stdout.write(s) }
  var println = function(s){ process.stdout.write(s+"\n") }


  // lib 
  var lib = require('./lib.js');
  var fs = require('fs');


  function print_config( config ) { 
    println("\n Saving config settings: ");
    println(" ---------------------------");
    for ( var i in config ) {
      if ( config.hasOwnProperty(i) ) {
        println( ' key: "' + i + '", value: "' + config[i] + '"' );
      }
    }
    println(" ---------------------------\n");
  }

  function read_config(config)
  {
    try {
      var file = lib.read_file( config.config_path );
      if ( file.trim().length > 0 )
        var parsed_obj = JSON.parse( file );
    } catch(e) {
      println( "\nDefault config not exist, creating.." );
      return;
    }

    for ( var i in parsed_obj ) {
      if ( parsed_obj.hasOwnProperty(i) ) {
        config[i] = parsed_obj[i];
      }
    }
  }
  exports.read_config = read_config;

  function write_config( config ) {
    // is dir? if not, create cir
    try {
      fs.mkdirSync( config.data_dir, 0755, function(){});
    } catch(e){ } 

    // write file
    try {
      lib.write_file( config.config_path, JSON.stringify(config,null,'  ') );  
    } catch(e) { }
  }
  exports.write_config = write_config;

  function after_conf_setup( config ) {
    config['autoconfig_done'] = 1;
    print_config( config );
    write_config( config );
  }
  exports.after_conf_setup = after_conf_setup;

  function do_interactive_setup( config, after_f, rl ) 
  {
    function entry(varname,question,next,def) 
    {
      this.varname = varname;
      this.question = question ? question : 'question';
      this.next = next ? next : null;
      this.defalt = def ? def : '';

      this.prompt = '?';
      this.response_text = 'got: ';
    }
    entry.prototype = {
      response: function(ans) {

        var look = ans ? ans : this.defalt;

        config[this.varname] = (typeof look === 'function' && look instanceof Function) ? look() : look;

        print( this.response_text )
        print('"'+config[this.varname]+'"');
        print("\n");

        rl.pause();

        if ( this.next && this.next.run )
          this.next.run();
        else if ( this.next )
          this.next();
      },

      run: function() {
        var that = this;
        var def = this.defalt ? ( (typeof this.defalt === 'function' && this.defalt instanceof Function) ? ' ['+this.defalt()+']' : ' ['+this.defalt+']' ) : '';
        rl.question( this.question + def + this.prompt+' ', function(s){that.response(s)} );
      },

      setPrompt: function(_p) { this.prompt = _p; }
    }; 


    //--------------------------------------------------
    // static iface for adding config question modules
    function config_items( varname, question, def ) {
      config_items.last_entry = new entry( varname, question, config_items.last_entry, def );
    }
    config_items.last_entry = after_f;
    config_items.run = function() { 
      if ( config_items.last_entry && config_items.last_entry.run )
        config_items.last_entry.run(); 
      else if ( config_items.last_entry )
        config_items.last_entry(); 
    }
    //--------------------------------------------------


    // create set of question and varname pairs. They appear in reverse order.

    // search paths
    //config_items( 'search_paths', 'enter the search paths' );

    // movies path
    config_items( 'movies_db_path', 'Where should we put the movie database', function(){return config.data_dir +'/'+config.movies_db_name} );
    // movie db name
    config_items( 'movies_db_name', 'What should we name the movie database', config.movies_db_name );
    // config_path
    config_items( 'config_path', 'Where should we put the config', function(){return config.data_dir +'/'+config.config_name} );
    // config name
    config_items( 'config_name', 'What should we name the config', config.config_name );


    // 
    config_items.run();

  }
  exports.do_interactive_setup = do_interactive_setup;

})();
