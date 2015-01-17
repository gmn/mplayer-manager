mplayermanager todo list
========================

* more robust lock function (tries multiple dirs)
  - just use config_dir
  - set lock_dir property in config object
  - what about multiple instances running different configs???
      (instead of using random lockfile name, hash configs-fullpath
      therefor, it's one set lockfile name per instance)
  - fine-tune which cmdline functions get locked out and which don't

* - Edit options for current file
    - so that when you hit 'o', the opts for the last file are filled in
    - after you press ENTER, the new options are saved immediately
  - current file is: "..."
  - play current file: 'l'

* 'watch -a <filename> [file2] [...] -opts "-v -aid 1 --fs -xy 1.33" -dir <dirname>'


// --fs, --speed=<0.01-100>, -aid <N>, -sid <N>, -softvol-max 1000 -volume 50, -xy <0.01-100>
--audiofile=<filename>
--audiofile-cache=<kBytes>
--subfile=<filename>
dvd://${CHAPTER} -dvd-device
br://${CHAPTER} -bluray-device
--aspect=1.7777
--aspect=16/9


- organize cmdline switches into those that must be blocked and those that do not need to block (eg. readonly)

README STUFF:
- "It keeps track of every file and where you left off in each file, so you can
jump around, but you're always moving forwards"
* This module is intended to be installed globally with 'npm install -g'

- watch -l 2, watch -l 3
- watch> l 2  ...

- better abstraction between core functions and interface; core functionality goes in completely in its own encapsulated class. UI methods merely call the Core class.  What about print() methods?  Unsure.  I could hand arrays back...

- abstract interface from control functions. This allows to create 2 iface modules:
  1) commandline
  2) browser



- better functionality design (can't do some things in interactive mode that
    you can from cmdline switches and vice-versa)


* have a /usr/bin/watch script which calls 'node /location_of_watch.js'

* interactive installation of run-script in /usr/bin/
  - asks for root pass to install

* playlists: way to {create, edit, delete, execute} multiple playlists


X rememember options per movie
N way to play watched movies

N won't work in NODE readline!!!
N TAB-completion <-- tab &/or getch() doesn't work in any input mode
    TAB-completion control wishlist:
    1 - press [w] Watch...; a prompt comes up. "watch what?> "
    2 - press 'J', 
    2b -then press TAB; available movies that start with J will appear in alphabetical order
    3 - press ESC to clear the line
    4 - press REturn to accept a choice
    5 - press more letters to narrow it down some
    6 - press up and down arrows to move selector, and ENTER to select
X config.json    - local database for config
X movies.json    - database for just movies
X 
X search path for config: [$HOME,"$HOME/.mplayermanager/",'.']
X
X startup dialog that runs first time, prompting user for:
X - location to store 'movies.json'
X - location to store 'config.json'
X 
X way in commandline to change config options
X rewrite 2nd set of cmdline functions to not be dependent on argv[] specific locations: eg. argv[2], but use check_arg() instead
  so example usage this would allow: "watch -c ./custom_config.js -a new_movie new_movie_dir".  Can't do this now.
    (note: you can make additional script: 'watchp' --> node ~/code/watch.js -c ./custom_conf.js')
X { sec_watched: } key in movie row. calculate total cumulative seconds watched for each file
X   account for skips using arrow keys, to get more accurate... Ohhhhh, just get current Unix()sec at beginning and Unix()sec at end.
X cmdline option to 
    - IMMEDIATELY ADD A FILE, 
    - DETERMINE ITS LOCATION AUTOMATICALLY, and if its not in the path list, 
    - AUTOMATICALLY CREATE A "DIR" ENTRY
X option to print out list of things watched, ordered by sec_watched
X save the num_last_watched: most recent watched
X rewrite the db format to include PERMANENT_INDEX, to simplify ordering them  (its buggy now)
  X two sets of movid: 1-N watched:true, 1-N watched:false
  X write pid by hand into movies.db
  X display code
  X load code
  X order code
  X change index code
  X call renormalize() in '-ci' function
  X put '[pid]' in -watched flag
X movies can have optional DISPLAY_NAME that appears instead of their filename. If you edit the "name" of a file, it creates a display_name and shows that instead
X move 'vid' script into watch.js
N ability to edit array of paths in setup
X even MORE intelligent path searching, using 'find /dir -name <file>'
  algorithm: go through path list. 
  X Or just get array of sub-dirs in each search-path, and look for the file in those.
X integrate file searching into the 'watch>' prompt, so that anything that didn't match a commandline switch or Number(), returns a partial match against every file in the db and prints the list. This alleviates having to specify a search explicitly. ??
X lastPlayed is an array. saves/shows the config.num_last_watched,

X _id will be completely untouched; deletion causes gaps == OK, new items
  get next higher _id
X hours / day:= cmdline switch prints; db {secsPerDay: 466, date: 2014-... }, {secsToday: 45, date: 2014...}.  
  N better yet: don't save it at all. Just run through all sec_watched sorted by last_played, and tally for each date. Note, however, this is innacurate in that you could watch the same file over a series of different days and time-periods. (their cumulative amount would just get lumped into the last day listed)
  X OK, this is the algorithm: Each time you stop the player, it adds on to an entry for that day in db.update( {secsToday:/.*/,date:lib.daynum()},{secsToday:new_secs,date:lib.daynum()}, {$upsert:true} );
X watch Stein --> "6 files matching "Stein""
X watch <exact match> // if there's an exact match it plays the file
X explicit video size modifier menu option
X add the movie, then play the movie, all in one cmdline command
X put on a lock when running, so if external shell adds file, it prints an error
X catch mplayer PAUSE, and figure that into time calculations


