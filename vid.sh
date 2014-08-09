#!/bin/bash

if [ ! "$1" ]; then 
    echo usage: $(basename $0) \[-opts \"mplayer options\"\][-dvd [track]] "<videos>"; 
    exit 0 ; 
fi

MPLAYER_OPTS=
VIDEO_TS=
OPTIRUN=optirun
OPTIRUN=
FONTCONFIG="-fontconfig"
FONTCONFIG=
FONT_SCALE=20
FONT_SCALE=10

function run_mplayer()
{
    #-msglevel identify=6 
    #-identif
    #-af scaletempo,equalizer=6:5:4:3:3:1:3:4:6:8
    #-af-add volume=11:1
    echo "
running: \"eval $OPTIRUN mplayer -noborder -vo gl -dr -noslices -ass -embeddedfonts -ass-line-spacing 0 -ass-font-scale 1 -ass-styles /home/gnaughto/.config/smplayer/styles.ass $FONTCONFIG -font Arial -subfont-autoscale 0 -subfont-osd-scale $FONT_SCALE -subfont-text-scale $FONT_SCALE -subcp ISO-8859-1 -stop-xscreensaver -vf-add screenshot -slices -af scaletempo,volume=12:1 -softvol -softvol-max 600 -volume 20 $MPLAYER_OPTS $VIDEO_TS $@\""
           eval $OPTIRUN mplayer -noborder -vo gl -dr -noslices -ass -embeddedfonts -ass-line-spacing 0 -ass-font-scale 1 -ass-styles /home/gnaughto/.config/smplayer/styles.ass $FONTCONFIG -font Arial -subfont-autoscale 0 -subfont-osd-scale $FONT_SCALE -subfont-text-scale $FONT_SCALE -subcp ISO-8859-1 -stop-xscreensaver -vf-add screenshot -slices -af scaletempo,volume=12:1 -softvol -softvol-max 600 -volume 20 $MPLAYER_OPTS $VIDEO_TS $@
}

# expand paths
N=1; A=0
GET_OPTS=0
GET_DVD=0
while [ $N -le $# ]; do
    #I="\$$N"
    ARG=`eval 'echo ${'$N'}'`
    echo "\$${N}: $ARG"

    if [ $GET_OPTS -eq 1 ]; then
        MPLAYER_OPTS=$ARG
        GET_OPTS=0
        echo "got mplayer options: \"$ARG\""
    elif [ $GET_DVD -eq 1 ]; then
        GET_DVD=0
        VIDEO_TS="dvd://$ARG -dvd-device"
    elif [ "${ARG:0:1}" != "-" ]; then
        MOVIE[$A]=`echo $(cd "$(dirname "$ARG")"; pwd)/$(basename "$ARG")`
        let A="$A+1"
    elif [ "$ARG" = "-opts" ]; then 
        GET_OPTS=1
    elif [ "$ARG" = "-dvd" ]; then 
        GET_DVD=1
        VIDEO_TS="dvd://1 -dvd-device" 
    fi

    let N="$N+1"
done

# check all files exist
A=0
while [ $A -lt ${#MOVIE[*]} ]; do
    if [ ! -e "${MOVIE[$A]}" ]; then 
        echo "file: \"${MOVIE[$A]}\" doesn't exist"
        exit 0
    fi
    let A="$A+1"
done

# escape paths
A=0
while [ $A -lt ${#MOVIE[*]} ]; do
    #MOVIE[$A]=`rescape "${MOVIE[$A]}"`
    MOVIE[$A]=`echo "${MOVIE[$A]}" | rescape`
    let A="$A+1"
done

#echo
#echo ${MOVIE[*]}

run_mplayer ${MOVIE[*]}

exit 0

