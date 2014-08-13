
Mplayer Manager
===============

A commandline interface for mplayer. It manages a database of movies and playlists, helping you to keep track of what is still in your queue and what you have watched already.  It keeps track of where you left off viewing each file and quick-resumes viewing again at that location.

This app is basically a helper tool for obsessive people who like to be watching a large number of movie files at any one time. It speeds up the process of finding, loading and resuming the files, as well as easing the process of keeping track of them all. It does all of that for you. For the perversely curious, it keeps a tally of the total time and which files you have watched as well.

All you have to do to use it is add a new movie by running ```watch -a <movie>```, and then enter interactive mode with ```watch```, and select the movie to watch it.

Note: you must have updated version of mplayer and node.js installed.

Author: Greg Naughton greg@naughton.org

# Installation Instructions
* ```npm install -g mplayermanager```
* ```sudo ln -s /usr/local/lib/node_modules/mplayermanager/watch.js /usr/bin/watch```
 * (or whichever path npm installed it to in your system)
* ```watch -pc```   (to show the default config options)
* edit your config.json  (path to config.json is given in ```watch -pc```)

# Usage Instructions
* use ```watch -a``` to add a movie to keep track of
* to add an entire directory of files use tricks such as: ```for i in *.mkv; do echo "adding $i"; watch -a "$i"; sleep 0.5; done```
 * (this will add every file ending in ".mkv" within a directory)
* more generally you can do: ```for i in *.???; do echo "adding $i"; watch -a "$i"; sleep 0.5; done```
 * (this will add every file with a 3 letter extension)
* ```watch -d``` to see what you have added so far
* ```watch``` to enter interactive mode 
* ```watch <id>``` to view a specific file directly (by its ID)
* use ```watch --help``` to see a whole list of options

# Bugs
* right now, some things can be done in interactive mode and not from commandline switches and vice-versa. 
