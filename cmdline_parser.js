// cmdline_parser.js
// small utility to help setup a config file.  It 
//  - parses options from the commandline


(function(){

  // 
  var print = function(s){ process.stdout.write(s) }
  var println = function(s){ process.stdout.write(s+"\n") }


  function check_cmdline( config )
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
  exports.check_cmdline = check_cmdline;

})();

/*
    // cmdline args
    if ( process.argv && process.argv.length > 2 ) 
    {
        var v = process.argv;
        var exename = v[1].substring( v[1].lastIndexOf('/')+1, v[1].length);

        // -h   help
        if ( v[2].match(/-h(.*)/i) || v[2].match('--help') ) {
            println( exename + ': [ [-h|--help] |-ci|-d|-dw|<#>|-add <filename> [dir]| [-l|-last] | [-s|-set] ]' );
            process.exit(0);
        // -ci --> change index
        } else if ( v[2].match( '-ci' ) ) {
            if ( v.length !== 5 ) {
                println( "-ci: expects 2 args: from INDEX and INDEX to insert before" );
                process.exit(0);
            }

            if ( v[3] < 0 || v[3] >= menu.movies.length || v[4] < 0 || v[4] >= menu.movies.length ) {
                println ( "values out of range" );
                process.exit(0);
            }

            // 
            db.remove({lastMovieId:{$exists:true}});

            // get _id for index1, _id for index2
            var id1 = menu.movies[v[3]]._id;
            var id2 = menu.movies[v[4]]._id;

            println( 'inserting "' + menu.movies[v[3]].file + '" before "' + menu.movies[v[4]].file + '"' );

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
        // -a   add
        } else if ( v[2].match(/-a(.*)/i) ) {
            if ( process.argv.length < 4 ) {
                println( exename + ': -add\'s a new movie. Expects a filename argument and optional search directory' );
            }

            var dir_arg = process.argv.length >= 4 ? v[4] : '';
            var mov_arg = v[3];

            if ( dir_arg )
                db.insert( {file:mov_arg,dir:dir_arg,added:db.now()} );
            else
                db.insert( {file:mov_arg,added:db.now()} );

debugger;
            db.save();
            println( '"' + mov_arg + '" added' );

            process.exit(0);
        // -dw dump watched
        } else if ( v[2].match('-dw') ) {
            var watched = db.find( {watched:true} ).sort( {_id:1} ).sort( {date_finished:1} ) ;
            for ( var index = 0, length = watched.count(); index < length; index++ ) {
                println( index +"\t"+ watched._data[index].file );
            }
            process.exit(0);
        // -d dump
        } else if ( v[2].match('-d') ) {
            var tab = "\t";
            for ( var index = 0, length = menu.movies.length; index < length; index++ ) {
                if ( menu.lastMov == index ) 
                  tab = "+\t";
                else
                  tab = "\t";
                println( index +tab+ menu.movies[index].file );
            }
            process.exit(0);
        // -l last
        } else if ( v[2].match(/-l(.*)/i) ) {
            
                if ( menu.lastMov === -1 ) {
                    println( "no movie played yet" );
                } else {
                    play_movie( menu.lastMov, menu.lastSec );
                }
        // -s -set
        } else if ( v[2].match(/-s(.*)/i) ) {
            function _sanity() {
                if ( v[3] < 0 || v[3] >= menu.movies.length ) {
                    println ( "values out of range" );
                    process.exit(0);
                }
            }
            if ( v.length === 4 ) {
                _sanity();
                println( "directory for file [" + v[3] + '] "' + menu.movies[v[3]].file + '" --> "' + menu.movies[v[3]].dir + '"' );
                process.exit(0);
            }
            if ( v.length !== 5 ) {
                println( "-s: expects 1 or 2 arguments" );
                process.exit(0);
            }
            _sanity();

            println( 'setting directory for file "' + menu.movies[v[3]].file +'" from "' + menu.movies[v[3]].dir + '" to "' + v[4] + '"' );

            db.update( {_id: menu.movies[v[3]]._id}, {'$set':{"dir":v[4]}} );
            db.save();
            process.exit(0);
        }
        
        else 
        {
            var k = Number( v[2] );
            if ( !isNaN(k) && k >= 0 && k < menu.movies.length ) {
                play_movie( k, menu.movies[k].resumeSec ? menu.movies[k].resumeSec : 0 );
            }
            else
            {
                println( "dont know that one" );
                process.exit(0);
            }
        }
    }

})();
*/

