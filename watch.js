#!/usr/local/bin/node
/* vim: set syntax=javascript: */


// begin namespace
(function() 
{
  var fs = require('fs');

  var lib = require( './lib.js' );
  var type_of = lib.type_of;
  var trunc_string = lib.trunc_string;

  var queryable = require( 'queryable' );
  var db = null;

  var spawn = require('child_process').spawn;
  var stdin = process.stdin;
  var stdout = process.stdout;

  var readline = require('readline');
  var rl = readline.createInterface( stdin, stdout );

  var read_options = 0;
  var continue_index = 0;
  var watched_continue_index = 0;
  var playing = 0;

  // default config
  var config = {
    user_home: process.env.HOME,
    user_name: process.env.LOGNAME,
    data_dir: process.env.HOME + '/.mplayermanager',
    config_name: 'config.json',
    config_path: process.env.HOME + '/' + '.mplayermanager/config.json',
    movies_db_name: 'movies.db',
    movies_db_path: process.env.HOME + '/' + '.mplayermanager/movies.db',
    search_paths: [
      process.env.HOME+'/Videos',
      process.env.HOME+'/Downloads',
      process.env.HOME,
      process.env.HOME+'/Desktop'],
    autoconfig_done: 0,
    preplay_timeout: 1200,
    vidplayer_silence: 1,
    num_last_watched: 5
  };

  var println = function(str) {
    if ( !str )
      stdout.write( "\n" );
    else
      stdout.write( str + "\n" );
  };

  var print = function(str) {
    stdout.write( str );
  };

  /*
   * Menu class
   */
  function MovieMenu () 
  {
    var that = this;
    var null_f = function() { return ''; };
    var dvd_f = function() { return that.dvd ? ' (-dvd is set)' : ''; };
    var opt_f = function() { return that.options ? ' (-opts "'+that.options+'")' : '' };
    var last_f = function() { return that.lastMov !== -1 ? ' (last: ['+that.lastMov+']'+trunc_string(that.movies[that.lastMov].file,30)+' @sec: '+that.lastSec+')' : '' };
    var out_f = function() { return config.vidplayer_silence ? ' (off)' : ' (on)' };
    var del_f = function() { return that.lastDeleted === '' ? '' : ' (last: "'+trunc_string(that.lastDeleted,40)+'")' };

    this.entries = [
        { ent: '[p] print movies', f: null_f },
        { ent: '[#] type number to play/resume movie', f: null_f },
        { ent: '[x] delete movie', f: del_f },
        { ent: '[o] set options', f: opt_f },
        { ent: '[s] start movie from beginning', f: null_f },
        { ent: '[l] resume last played', f: last_f },
        { ent: '[t] toggle vidplayer output', f: out_f },
        { ent: '[m] mark as watched', f: null_f },
        { ent: '[u] mark un-watched', f: null_f },
        { ent: '[w] list watched', f: null_f },
        { ent: '[q] quit', f: null_f }
    ];

    this.options = '';
    this.dvd = 0;
    this.lastMov = -1;
    this.lastSec = 0;
    this.startOverPid = -1;
    this.lastDeleted = '';
  }
  MovieMenu.prototype = {
    print: function() 
    {
      println();
      for ( var i = 0, len = this.entries.length; i < len; i++ ) {
        println( this.entries[i].ent + this.entries[i].f() );
      }
    },
    toggleDvd: function() {
      this.dvd = this.dvd ? 0 : 1;
      return this.dvd;
    },
    setLastSec: function(f) {
      if ( !f )
        return;
      this.lastSec = (f+'').replace(/\..*/,'');
    },
    setLastDeleted: function(mvname) {
      this.lastDeleted = mvname;
      db.update({'lastDeleted':/.*/},{'$set':{'lastDeleted':mvname}},{'upsert':true});
      db.save();
    },
    indexFromPid: function(pid) {
      for ( var i = 0, l = this.movies.length; i<l; i++ ) {
        if ( this.movies[i].pid === pid )
          return i;
      }
      return -1;
    },
    highestUnwatchedPid: function() {
      var hpid = 0;
      for ( var i = 0, l = this.movies.length; i<l; i++ ) {
        if ( this.movies[i].pid > hpid )
          hpid = this.movies[i].pid;
      }
      return hpid;
    },
    highestWatchedPid: function() {
      var watched = db.find( {watched:true} ).sort( {pid:-1} ).limit(1);
      return watched.length === 0 ? 0 : watched._data[0].pid;
    },
    renormalizeUnwatchedPid: function( starting ) {
      var start_id = starting ? starting : 0;
      var res = db.find( {$or:[{watched:false},{watched:{$exists:false}}]} ).sort( {pid:1} );
      for ( var i = start_id, l = res._data.length; i<l; i++ ) {
        db.update( {_id:res._data[i]._id}, {$set:{pid:i+1}} );
      }
    },
    renormalizeWatchedPid: function( starting ) {
      var start_id = starting ? starting : 0;
      var res = db.find( {watched:true} ).sort( {pid:1} );
      for ( var i = start_id, l = res._data.length; i<l; i++ ) {
        db.update( {_id:res._data[i]._id}, {$set:{pid:i+1}} );
      }
    }
  };

  var menu = new MovieMenu();
  menu.play_movie = play_movie;


  //
  // setup the config
  //
  var config_helper = require( './config_helper.js' );
  var cmdline_parser = require( './cmdline_parser.js' );

  // handle command line flags that affect config 
  cmdline_parser.check_cmdline( config );

  // if default conf path exist, read the config from there
  config_helper.read_config( config );


  // called after config setup complete
  function begin_execution()
  {
    // read the movies database
    db = queryable.open( config.movies_db_path );

    // get movies list
    reload_movies_list();

    //
    // startup the readline interface
    //
    rl.setPrompt('watch> ');

    rl.on('line', readline_line_function ).on('close', function() {
      println('Ctrl+D caught. Exiting.');
      process.exit(0);
    });
    rl.resume();

    // cmdline opts that do something
    if ( cmdline_parser.execute_commands( db, menu, config ) ) 
    {
      // if nothing happens as result of cmdline, show the menu
      menu.print();
      rl.prompt();
    }
  }


  // if we only have default config, run interactive script that allows user to customize it during creation
  // - then begin execution  
  if ( !config || !config.autoconfig_done ) {
    config_helper.do_interactive_setup( config, rl, function() {
      config_helper.after_conf_setup( config );
      begin_execution();
    } );
  } else {
    begin_execution();
  }

  // capture last second viewed from mplayer output
  function sec_from_mplayer_stream( m_stream ) 
  {
    var lines = m_stream.toString().split("\n");

    if ( !lines || !(lines.length > 0) )
      return null;

    // FIXME - this is going from beginning all the way to the last line, shouldn't I just shift off the first line???
    do
    {
      var last_line = lines.pop();
    } while ( !last_line && lines && lines.length > 0 );

    var terms = last_line.split( /[:\s]+/ );
    if ( !terms || !(terms.length > 0) || terms[0] !== 'A' )
      return null;

    return terms[1];
  } // sec_from_mplayer_stream

  function system( index, cmd, args_array )
  {
    var start_sec = -1;
    var end_sec = -1;
    var p = spawn( cmd, args_array, { env: process.env });

    p.stdout.on('data', function (data) {
      if ( !config.vidplayer_silence )
        println( data );

      var sec = sec_from_mplayer_stream( data );
      if ( sec ) {
        if ( start_sec === -1 ) { 
          start_sec = Math.round(Date.now()*0.001);
        }
        menu.setLastSec( sec );
      }
    });

    p.stderr.on('data', function (data) {
      if ( !config.vidplayer_silence )
        println( 'stderr: ' + data );
    });

    p.on('close', function (code) {
      println('child process exited with code ' + code);
      println('last sec watched: ' + menu.lastSec);

      end_sec = Math.round(Date.now()*0.001);
      var total_sec_this_run = end_sec - start_sec;
      var total_sec = (menu.movies[index].sec_watched ? menu.movies[index].sec_watched : 0) + total_sec_this_run;

      menu.print();
      rl.prompt();

      menu.movies[index].resumeSec = menu.lastSec; // set this key for this movie
      db.update( {_id:menu.movies[index]._id}, {'$set':{'resumeSec':menu.lastSec,'sec_watched':total_sec}} );
      db.save();

      menu.startOverPid = -1; // reset this always afterwards
    });
  } // system


  function print_movies(line) 
  {
    //reload_movies_list() ;

    if ( line.trim().length > 0 ) {
      continue_index = 0;
      return;
    }
    
    var col = stdout.columns, row = stdout.rows;

    var disp_rows = row - 2;

    var i, index, len;

    for ( i = 0, index = continue_index, len = menu.movies.length; index < len && i < disp_rows; index++, i++ ) {
      var x = menu.movies[index].resumeSec ? "  (@"+menu.movies[index].resumeSec+")" : '';
      var m = x ? ' t ' : '   ';
      println( menu.movies[index].pid + m + menu.movies[index].file + x );
    }
    if ( i === disp_rows && menu.movies.length > index ) {
      continue_index = index;
      print("--------------- PRESS ENTER ---------------");
    }
    else
      continue_index = 0;
  } // print_movies

  function print_watched_movies()
  {
    var col = stdout.columns, row = stdout.rows;
    var disp_rows = row - 2;
    var i, index, len;
    var watched = db.find( {watched:true} ).sort( {pid:1} );
    for ( i = 0, index = watched_continue_index, len = watched.length; index < len && i < disp_rows; index++, i++ ) {
      var t = watched._data[index].date_finished;
      t = t ? " finished: " + t.substring(0,10) : '';
      println( watched._data[index].pid + ' ' + watched._data[index].file + t );
    }
    if ( i === disp_rows && watched.length > index ) {
      watched_continue_index = index;
      print("--------------- PRESS ENTER ---------------");
    }
    else
      watched_continue_index = 0;
  } // print_watched_movies

  // searches through search paths, looking for file matching 'filename'
  // returns full path if found, null if not
  function find_file( filename, xtrapath )
  {
    var paths = config.search_paths;

    var loc_paths = paths.slice(0);

    // add to path: xtra can be: string, array of strings
    //if ( xtrapath && (type_of(xtrapath) === "string" || type_of(xtrapath) === "array") ) 
    if ( xtrapath && type_of(xtrapath) === "string" ) {
      //println( "adding xtra path: " + xtrapath.toString() );
      //loc_paths = loc_paths.concat( xtrapath );

      // add the extra path to search paths
      loc_paths.push( xtrapath );

      // splice the extra path ONTO each of the original search paths. Good for movies in their own folder
      paths.forEach( function(path) {
        var compound_path = path.charAt(path.length-1) === '/' || xtrapath[0] === '/' ? path + xtrapath : path + '/' + xtrapath;
        loc_paths.push( compound_path );
      });

      //loc_paths.splice( loc_paths.length,0,xtrapath );
    }

    for ( var i = 0, l = loc_paths.length; i<l; i++ ) 
    {
      println( "trying path: " + loc_paths[i] );
      var fullpath = loc_paths[i][loc_paths[i].length-1] === '/' ||
                      filename[0] === '/' ? loc_paths[i] + filename : loc_paths[i] + '/' + filename;
      try {
        var yep = fs.statSync( fullpath );
      } catch ( err ) {
        continue; // note: gay
      }
      return fullpath; // it'll throw (whatever that means) if path not found (note: throwing errors is fucking gay) 
    }
    return null;
  } // find_file

  function play_movie( pid, resume_sec )
  {
    var n = menu.indexFromPid(pid);

    var fullpath = find_file( menu.movies[n].file, (menu.movies[n].dir ? menu.movies[n].dir : null) );
    if ( !fullpath ) {
      print( "file: \""+menu.movies[n].file+"\" does not exist or can't be found" );
      return;
    }

    playing = 1;

    var args = [fullpath];
    menu.lastMov = pid;
    db.update({'lastMoviePid':/.*/},{'$set':{'lastMoviePid':menu.movies[n]['pid']}},{'upsert':true});
    db.save();

    if ( menu.dvd || fullpath.match(/video_ts/i) ) {
      args.push( "-dvd" );
    }

    var options = menu.options;
    if ( resume_sec ) {
      options = menu.options + " -ss " + resume_sec;
    }

    if ( options ) {
      args.push( "-opts" );
      args.push( options );
    }

    print( "running: vid \""+args.join('" "')+'"' );

    dotdotdot( config.preplay_timeout, function() { system( n, 'vid', args ); } );
  } // play_movie

  function dotdotdot( timeout, func ) {
    if ( timeout <= 0 )
      return func();
    print( '.' );
    setTimeout( function(){ dotdotdot( timeout-300, func ); }, 300 );
  }

  function readline_line_function(line) 
  {
    if ( menu && menu.movies && menu.movies.length === 0 )
      reload_movies_list();

    playing = 0;

    if ( continue_index !== 0 ) {
      print_movies(line);         
    } else if ( watched_continue_index !== 0 ) {
      print_watched_movies();
    } 

    // options
    else if ( read_options === 1 ) { 
      menu.options = line.trim();
      read_options = 0;
    } 

    // mark file
    else if ( read_options === 3 ) {
      read_options = 0;
      var pid = Number( line.trim() );

      if ( line.trim().length === 0 || isNaN( pid ) ) {
        println( "That's not a movie index, silly." );
      } else if ( pid < 0 || pid >= menu.highestUnwatchedPid() ) {
        println( "Not in range" );
      } 
      else {
        var mark = menu.indexFromPid( pid );
        var mark_id = menu.movies[mark]._id;

        if ( menu.movies[mark].watched && menu.movies[mark].watched === true ) {
          println( "Already watched that one on: " + menu.movies[mark].date_finished );
        } else {
          var filename = menu.movies[mark].file;
          var new_pid = menu.highestWatchedPid() + 1;
          print( "\nMarking \"" + filename + "\" as watched... " );
          var r = db.update( {_id:mark_id}, {$set:{watched:true,date_finished:db.now(),pid:new_pid}} );
          menu.renormalizeUnwatchedPid();
          if ( r === 1 ) { 
            db.remove({lastMoviePid:{$exists:true}});
            db.save(); 
            menu.lastMov = -1;
            reload_movies_list() ;
            println( "done." ); 
          } else { 
            println( "unsuccessful" ); 
          }
        }
      }
    }

    // unmark file
    else if ( read_options === 4 ) { 
      read_options = 0;
      var unwatch_pid = Number( line.trim() );
      var watched = db.find( {watched:true} ).sort( {pid:1} );
      
      if ( line.trim().length === 0 || isNaN( unwatch_pid ) ) {
        println( "That's not a movie index, silly." );
      } else if ( unwatch_pid < 1 || unwatch_pid > menu.highestWatchedPid() ) {
        println( "Not in range" );
      } 
      else {
        var unwatch_index = -1;
        for ( var i = 0, l = watched._data.length; i<l; i++ ) {
          if ( watched._data[i].pid === unwatch_pid ) {
            unwatch_index = i;
            break;
          } 
        }
        // set unwatched and update dateAdded, to effectively
        var new_pid = menu.highestUnwatchedPid() + 1;
        db.update( {_id:watched._data[unwatch_index]._id}, {$set:{watched:false,added:db.now(),pid:new_pid}} );
        menu.renormalizeWatchedPid();
        db.save();
        var file = watched._data[unwatch_index].file;
        reload_movies_list();
        println( "\n\""+file+'" marked unwatched and set to: ' + new_pid );
      }
    } 

    // remove file from db
    else if ( read_options === 5 ) 
    {
      read_options = 0;
      var delete_pid = Number( line.trim() );

      if ( line.trim().length === 0 || isNaN( delete_pid ) ) {
        println( "That's not a movie index, silly." );
      } else if ( delete_pid < 0 || delete_pid >= menu.movies.length ) {
        println( "Not in range" );
      } else {
        var delete_index = menu.indexFromPid(delete_pid);
        var res = db.remove( {_id:menu.movies[delete_index]._id} );
        db.save();
        println( "\nMovie: \""+menu.movies[delete_index].file+'" deleted permanently from '+config.movies_db_name );
        menu.setLastDeleted( menu.movies[delete_index].file );
        reload_movies_list();
      }
    }
    else 
    {
      if ( read_options === 2 /* start file at beginning */ ) { 
        menu.startOverPid = Number( line.trim() );
        read_options = 0;
      }

      switch(line.trim()) {
      case 'p': 
          print_movies('');
          break;
      case 'q':
          println( "goodbye" );
          process.exit(0);
          break;
      case 'd':
          println( 'dvd set to '+ (menu.toggleDvd() ? 'on' : 'off') ); 
          break;
      case 'o':
          print("set options> ");
          read_options = 1;
          break ;
      case 'hello':
          println('hey there!');
          break;
      case 'l':
          if ( menu.lastMov === -1 ) {
              println( "no movie played yet" );
          } else {
              play_movie( menu.lastMov, menu.lastSec );
          }
          break;
      case 't':
          config.vidplayer_silence = config.vidplayer_silence ? 0 : 1;
          break;
      case 's':
          print("start which from beginning> ");
          read_options = 2;
          break;
      case 'm':
          print( "mark which as watched> " );
          read_options = 3;
          break;
      case 'w':
          print_watched_movies();
          break;
      case 'u':
          print( "set which to unwatched> " );
          read_options = 4;
          break;
      case 'x':
          print( "delete which> " );
          read_options = 5;
          break;
      case 27: /* doesn't work */
          print( "ESC" );
          read_options = 0;
          continue_index = watched_continue_index = 0;
          break;
      default:
          var n = Number(line.trim());
          if ( line.length === 0 ) {
              // do nothing
          } else if ( typeof n !== "number" ) {
              println( 'Not sure if I\'ve heard of "' + line.trim() + '"' );
          } else if ( n >= 0 && n < menu.movies.length ) {
              if ( menu.startOverPid !== -1 ) {
                  play_movie( menu.startOverPid );
                  menu.startOverPid = -1;
              } else {
                  play_movie( n, menu.movies[n].resumeSec ? menu.movies[n].resumeSec : 0 );
              }
          } else {
              println( "selection out of range!" );
          }
          break;
      }
    }

    if ( playing ) {
      // 
    } else if ( continue_index !== 0 || watched_continue_index !== 0 ) { 
      // nada
    } else if ( !read_options ) {
      menu.print();
      rl.prompt();
    }
  } // readline_line_function

  function reload_movies_list()
  {
    //var movies_res = db.find( {file:{$exists:true},$or:[{watched:false},{watched:{$exists:false}}]} ).sort({_id:1}).sort({added:1});
    var movies_res = db.find( {file:{$exists:true},$or:[{watched:false},{watched:{$exists:false}}]} ).sort({pid:1});

    // got movies finally
    menu.movies = movies_res.getArray();

    // setup last movie
    var lasmov = db.find({lastMoviePid:/.*/});
    if ( lasmov.length > 0 ) {
      var lmpid = lasmov._data[0].lastMoviePid;
      for ( var index = 0, ml = menu.movies.length; index < ml; index++ ) {
        if ( lmpid === menu.movies[index].pid ) {
          menu.lastMov = lmpid;
          menu.lastSec = menu.movies.length > 0 ? menu.movies[index].resumeSec : 0;
          break;
        }
      }
    }

    // setup last deleted
    var res = db.find({lastDeleted:/.*/});
    if ( res.length > 0 ) {
      menu.lastDeleted = res._data[0].lastDeleted;
    }
  } // reload_movies_list

})();

