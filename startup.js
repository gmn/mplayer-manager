//

(function(){

var config = {
  user_home: process.env.HOME,
  user_name: process.env.LOGNAME,
  data_dir: process.env.HOME + '/.mplayermanager',
  config_name: 'config.json',
  config_path: process.env.HOME + '/' + '.mplayermanager/config.json',
  movies_db_name: 'movies.db',
  movies_db_path: process.env.HOME + '/' + '.mplayermanager/movies.db',
  search_paths: [
    process.env.HOME, 
    process.env.HOME+'/Videos', 
    process.env.HOME+'/Downloads'],
  autoconfig_run: 0
};

// 
var print = function(s){ process.stdout.write(s) }
var println = function(s){ process.stdout.write(s+"\n") }

// readline is node builtin
var readline = require('readline'), 
    rl = readline.createInterface(process.stdin, process.stdout);

// lib 
var lib = require('./lib.js');
var fs = require('fs');


function do_setup( after_f ) 
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
  //-------------------


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
  
  return config;
}

function print_config() { 
  println("\n Saving config settings: ");
  println(" ---------------------------");
  for ( var i in config ) {
    if ( config.hasOwnProperty(i) ) {
      println( ' key: "' + i + '", value: "' + config[i] + '"' );
    }
  }
  println(" ---------------------------\n");
}

function write_config() {
  // is dir? if not, create cir
  try {
    fs.mkdirSync( config.data_dir, 0755, function(){});
  } catch(e){ } 

  // write file
  try {
    lib.write_file( config.config_path, JSON.stringify(config,null,'  ') );  
  } catch(e) { }
}

function after_autoconf_run() {
  config['autoconfig_run'] = 1;
  print_config();
  write_config();
}


function check_cmdline()
{
  function print_help()
  {
    print( process.argv[1] + ":\n" );
    var p = function(s) { println( ' ' + s ) };
    p( '-c <config_path>  read the config from this location' );
    p( '-k <key> <val>    manually set key:value pairs in the config.' );
    process.exit(0);
  }

  function check_flag( flag, next )
  {
    var start_ind = next ? next : 2;

    for ( var i = start_ind; i < process.argv.length; i++ )
    {
      if ( flag === process.argv[i] ) {
        return i;
      }
    }

    return false;
  }

  //
  // entry point
  //
  if ( check_flag( '--help' ) || check_flag('-h') ) 
    print_help();

  var p = 0;
  if ( (p=check_flag( '-c' )) ) {
    if ( !process.argv[p+1] ) {
      println( '-c expects argument: <config_path>' );
      process.exit(-1);
    }
    config['config_path'] = process.argv[p+1];
    println('setting config_path to "'+config.config_path+'"');
  }

  var p = 2;
  while ( (p=check_flag('-k', p)) ) {
    if ( !process.argv[p+1] || !process.argv[p+2] ) {
      println( '-k expects two arguments: <key> <value>' );
      process.exit(-1);
    }
    var key = process.argv[p+1];
    var val = process.argv[p+2];
    config[ key ] = val;
    println('setting config key: "'+key+'" to "'+val+'"');
    p = p + 3;
  }
}

//
// BEGIN EXECUTION
//
rl.pause();

// absorb command line flags
debugger;
check_cmdline();

// check default conf path, if exist, load conf
try {
  var _f = lib.read_file( config.config_path );
  if ( _f.trim().length > 0 )
    config = JSON.parse( _f );
} catch(e) { 
  println( "Default config not exist, creating.." );
}

// 
if ( !config || !config.autoconfig_run )
  do_setup( after_autoconf_run );
else
{
}

})();
