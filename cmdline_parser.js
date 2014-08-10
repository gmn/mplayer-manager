// cmdline_parser.js
// small utility to help setup a config file.  It 
//  - parses options from the commandline


(function(){

  var PATH = require('path');
  var fs = require('fs');

  // 
  var print = function(s){ process.stdout.write(s) }
  var println = function(s){ process.stdout.write(s+"\n") }
  var exename = process.argv[1].substring( process.argv[1].lastIndexOf('/')+1, process.argv[1].length);


  function check_flag( flag, next )
  {
    var start_ind = next ? next : 2;

    for ( var i = start_ind; i < process.argv.length; i++ ) {
      if ( flag === process.argv[i] ) {
        return i;
      }
    }

    return false;
  }


  // flags checked for (and must be skipped later) in check_cmdline
  var early_flags = ['-c','-k','-nc'];

  function check_cmdline( config )
  {
    function print_help()
    {
      print( exename + ":\n" );
      var p = function(s) { println( ' ' + s ) };
      p( '-c <config_path>  read the config from this location' );
      p( '-k <key> <val>    manually set key:value pairs in the config.' );
      p( '--help, -h        print this menu' );
      p( '-ci               change index' );
      p( '-d                dump list of files' );
      p( '-dw               dump list of watched file' );
      p( '<#>               play movie with index <#>' );
      p( '-a <file> [dir]   add file, dir is optional' );
      p( '-l                play last played' );
      p( '-s                set directory file is in' );
      p( '-nc               force-start a new config' );
      process.exit(0);
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

      process.argv.splice(p+1,1);
      process.argv.splice(p+0,1);
    }

    p = 2;
    while ( (p=check_flag('-k', p)) ) {
      if ( !process.argv[p+1] || !process.argv[p+2] ) {
        println( '-k expects two arguments: <key> <value>' );
        process.exit(-1);
      }
      var key = process.argv[p+1];
      var val = process.argv[p+2];
      config[ key ] = val;
      println('setting config key: "'+key+'" to "'+val+'"');

      process.argv.splice(p+2,1);
      process.argv.splice(p+1,1);
      process.argv.splice(p+0,1);
      //p = p + 3;
    }

    if ( (p=check_flag('-nc')) ) {
      config.config_path = undefined;
      process.argv.splice(p,1);
    }

  } // check_cmdline
  exports.check_cmdline = check_cmdline;


  // cmdline args that do something
  function execute_commands( db, menu, config )
  {
    var v = process.argv;
    var ind = 0;
    var arg1, arg2;
debugger;

    // -ci == change index
    if ( (ind=check_flag("-ci")) ) 
    {
      arg1 = v[ ind + 1 ];
      arg2 = v[ ind + 2 ];

      if ( !arg1 || !arg2 ) {
        println( "-ci: expects 2 args: from INDEX and INDEX to insert before" );
        process.exit(0);
      }

      if ( arg1 < 0 || arg1 >= menu.movies.length || arg2 < 0 || arg2 >= menu.movies.length ) {
        println ( "values out of range" );
        process.exit(0);
      }

      // 
      db.remove({lastMovieId:{$exists:true}});

      // get _id for index1, _id for index2
      var id1 = menu.movies[arg1]._id;
      var id2 = menu.movies[arg2]._id;

      println( 'inserting "' + menu.movies[arg1].file + '" before "' + menu.movies[arg2].file + '"' );

      function row_by_id( r_id ) {
        var i = 0, l = db.master.length;
        for (; i < l; i++ ) {
          if ( db.master[i]._id === r_id )
            return i;
        }
        return -1;
      }

      function _highest_id() {
        var i = 0, l = db.master.length, h = -1;
        for (; i < l; i++ ) {
          if ( db.master[i]._id > h )
            h = db.master[i]._id;
        }
        return h;
      }

      // find row in db.master with (_id == id2)
      var end_row = row_by_id( id2 );
      var start_row = row_by_id( id1 );
      var highest_id = _highest_id();

      // increment every index, starting with id2 to the end of the list
      //  or until no row uses an index twice
      var row = -1;
      var n = highest_id;
      while ( n >= id2 ) 
      {
        row = row_by_id(n);
        if ( row !== -1 ) {
          db.master[row]._id++;
        }
        --n;
      }

      // set index id1 to id2
      db.master[start_row]._id = id2;
      db.master[start_row].added = db.master[end_row].added;

      // sort by _id asc
      db.master = db.master.sort(function(a,b){return a._id - b._id});
      db.save()
      process.exit(0);
    } 

    // -a   add
    else if ( (ind=check_flag('-a')) ) 
    {
      arg1 = v[ ind + 1 ];
      arg2 = v[ ind + 2 ];

      if ( !arg1 ) {
        println( exename + ': -a add\'s a new movie. Expects a filename argument and optional search directory' );
        process.exit(0);
      }

      var mov_arg = arg1;
      var dir_arg = arg2;

      function finish(file,dir)
      {
        db.save();
        dir = dir ? ', dir: "'+dir+'"' : '';
        println( 'file: "' + file + '"'+dir+' added' );
        process.exit(0);
      }

      // 1 - if the dir argument is supplied, just add file:arg1, dir:arg2 - no questions asked
      if ( dir_arg ) {
        db.insert( {file:mov_arg,dir:dir_arg,added:db.now()} );
        finish( mov_arg, dir_arg );
      }

      // no second argument, resolve arg1
      var fullpath = PATH.resolve(arg1);
      var dirname = PATH.dirname(fullpath);
      var basename = PATH.basename(fullpath);

      // 1b - if PATH.resolve(file) doesn't stat(), just add the unedited original string argument AS IS
      try {
        fs.statSync( fullpath );
      } catch(e) {
        db.insert( {file:mov_arg,added:db.now()} );
        finish( mov_arg );
      }

      // 2 - see if its dirname is in the pathlist; if it is, just add basename
      if ( config.search_paths.indexOf( dirname ) > -1 ) {
        db.insert( {file:basename,added:db.now()} );
        finish( basename );
      }

      // 
      // 3 - else 
      //        try to clip off /last_dir/ of dirname
      var last_dir = '';
      var dirname2 = '';
      if ( dirname.lastIndexOf('/') !== -1 ) {
        last_dir = dirname.slice( dirname.lastIndexOf('/') );
        dirname2 = dirname.slice( 0, dirname.lastIndexOf('/') );
        if ( last_dir.charAt(0) === '/' )
          last_dir = last_dir.slice(1);
        if ( last_dir.charAt(last_dir.length-1) === '/' )
          last_dir = last_dir.slice(0,last_dir.length-1);
      }

      // 4 - if fails: add file:basename, dir:dirname
      else {
        db.insert( {file:basename,dir:dirname,added:db.now()} );
        finish( basename, dirname );
      }

      // 5 - else (it succeeds, producing:  dirname ==> dirname2 + last_dir )
      //   - see if dirname2 is in pathlist; 
      //     - if it is, add file:basename with "dir":"last_dir"
      if ( config.search_paths.indexOf( dirname2 ) > -1 ) {
        db.insert( {file:basename,dir:last_dir,added:db.now()} );
        finish( basename, last_dir );
      }

      // - else 
      //      add file:basename with "dir":"dirname"
      db.insert( {file:basename,dir:dirname,added:db.now()} );
      finish( basename, dirname );
    }

    // -dw dump watched
    else if ( check_flag('-dw') ) 
    {
      var watched = db.find( {watched:true} ).sort( {_id:1} ).sort( {date_finished:1} ) ;
      for ( var index = 0, length = watched.count(); index < length; index++ ) {
        println( index +"\t"+ watched._data[index].file );
      }
      process.exit(0);
    } 

    // -d dump
    else if ( check_flag('-d') ) {
      var tab = "\t";
      for ( var index = 0, length = menu.movies.length; index < length; index++ ) {
        if ( menu.lastMov == index ) 
          tab = "+\t";
        else
          tab = "\t";
        println( index +tab+ menu.movies[index].file );
      }
      process.exit(0);
    } 

    // -l ==> last
    else if ( check_flag('-l') ) 
    {
      if ( menu.lastMov === -1 ) {
        println( "no movie played yet" );
      } else {
        menu.play_movie( menu.lastMov, menu.lastSec );
        return false;
      }
    }

    // -s ==> set
    else if ( (ind=check_flag('-s')) ) 
    {
      arg1 = v[ ind + 1 ];
      arg2 = v[ ind + 2 ];

      function _sanity() {
        if ( arg1 < 0 || arg1 >= menu.movies.length ) {
          println ( "values out of range" );
          process.exit(0);
        }
      }

      if ( !arg2 ) {
        _sanity();
        println( "directory for file [" + arg1 + '] "' + menu.movies[arg1].file + '" --> "' + menu.movies[arg1].dir + '"' );
        process.exit(0);
      }

      if ( !arg1 ) {
        println( "-s: expects 1 or 2 arguments" );
        process.exit(0);
      }
      _sanity();

      println( 'setting directory for file "' + menu.movies[arg1].file +'" from "' + menu.movies[arg1].dir + '" to "' + arg2 + '"' );

      db.update( {_id: menu.movies[arg1]._id}, {'$set':{"dir":arg2}} );
      db.save();
      process.exit(0);
    }

    // try to play movie by number if valid movie[index] given
    // FIXME: what if there's -c or -k arguments. Should be able to "watch -c my.conf 152"
    else 
    {
      if ( !v[2] )
        return true;

      var k = Number( v[2] );
      if ( !isNaN(k) && k >= 0 && k < menu.movies.length ) {
        menu.play_movie( k, menu.movies[k].resumeSec ? menu.movies[k].resumeSec : 0 );
        return false;
      }
      else
      {
        // if flags already checked for, run normally
        for ( var i = 0; i < early_flags.length; i++ ) {
          if ( v[2].match( early_flags[i] ) )
            return true;
        }

        println( "dont know that one" );
        process.exit(0);
      }
    }

    return true;

  } // execute_commands
  exports.execute_commands = execute_commands;

})();
