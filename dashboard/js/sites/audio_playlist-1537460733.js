var AUDIO_PLAYLIST = (function(){
	// configuration and vars
	var audio,
		playlist,
		tracks,
		current,
		jumptotime,
		isAutoAdvanceOn = false,
		selector_track_holder = ".track",
		id_audio_element = "audio_playlist_element",
		selector_audio_element = "audio#" + id_audio_element,
		class_playlink = "inline-playable",
		selector_playlink = selector_track_holder + " button." + class_playlink,
		selector_progress_bar = selector_track_holder + " .progress_bar",
		class_progress_indicator = "progress_indicator",
		selector_progress_indicator = selector_progress_bar + " ." + class_progress_indicator,
		class_active = "active",
		class_playing = "playing",
		class_loading = "loading",
		selector_active = "." + class_active,
		do_loop = false,
		selector_widget_ap = "#jplayer";

	var init = function(){
		current = 0;
		audio = $(selector_audio_element).length > 0 ? $(selector_audio_element) : $("<audio id='" + id_audio_element + "'></audio>").appendTo($("body"));
		playlist = $(selector_track_holder);
		tracks = $(selector_playlink);
		var len = tracks.length - 1;
		audio[0].volume = 1;

		if (tracks.length < 2) {
			do_loop = false; // don't loop on singles
		}

		$(selector_progress_bar).off("click").on("click", function(e){
			e.preventDefault();
			var ctrack = $(this).closest(selector_active);
			if (ctrack.length <= 0) { // only deal with current track
				return;
			}
			link = ctrack.find("." + class_playlink);
			current = $(selector_playlink).index(link);
			var click_position = getPositionOfClick(e);
			jumptotime = click_position.hpercent;
			run($(link), audio[0], false);
		});

		$(selector_playlink).off("click").on("click", function(e){
			link = $(this);
			current = $(selector_playlink).index(link);
			run($(link), audio[0], false);
		});

		$(audio[0]).off("play").on("play",function(e){
			if (jumptotime) {
				var src_element = e.srcElement || e.target;
				var jt_sec = src_element.duration * jumptotime;
				src_element.currentTime = jt_sec;
				jumptotime = null;
			}
			stopOtherPlayers();
		});

		$(audio[0]).off("ended").on("ended", function(e) {
			if (isAutoAdvanceOn) {
				current = getNextPlayableTrackIndex(current);
				if (current != null) {
					link = $(selector_playlink)[current];
					run($(link),audio[0]);
				} else {
					resetPlayLinks();
				}
			} else {
				resetPlayLinks();
			}
		});
	};

	var resetPlayLinks = function() {
		stopAndClearPlayer();
		current = 0;
		$(selector_progress_indicator).css("width","0%"); // reset all indicators
		$(selector_playlink).closest(selector_track_holder).removeClass(class_playing).removeClass(class_active).removeClass(class_loading);
	};

	var getNextPlayableTrackIndex = function(current_index) {
		var next_track_index = null,
			all_tracks = $(selector_playlink);
		$(all_tracks).each(function(i,v){
			if (i > current_index && $(all_tracks[i]).src != "") {
				next_track_index = i;
				return false;
			}
		});
		if (next_track_index == null) { // case in which no 'next' was found in >indices, try starting at 0
			$(all_tracks).each(function(i,v){
				if (i <= current_index && $(all_tracks[i]).src != "") {
					next_track_index = i;
					if (do_loop == false) {
						next_track_index = null;
					}
					return false;
				}
			});
		}
		return next_track_index;
	};

	var getPositionOfClick = function(clickEvent) {
		var width = clickEvent.currentTarget.offsetWidth;
		var pos = clickEvent.pageX;
		var offset = $(clickEvent.currentTarget).offset().left;
		var h_percent_click = (pos-offset)/width;

		var height = clickEvent.currentTarget.offsetHeight;
		pos = clickEvent.pageY;
		offset = clickEvent.currentTarget.offsetTop;
		var v_percent_click = (pos-offset)/height;
		return {"hpercent":h_percent_click, "vpercent":v_percent_click};
	};

	var run = function(link, player, is_paused) {
		var new_src = $(link).data("src");
		var par = link.closest(selector_track_holder);
		// pause if already playing this src
		if (new_src && player && new_src === $(player).attr("src")) {
			if (audio[0].paused) {
				par.toggleClass(class_loading, true).toggleClass(class_playing, false);
				audio[0].play();
			} else {
				audio[0].pause();
				if (jumptotime) {
					audio[0].play(); // will trigger play event, which will jumptotime
				} else {
					par.toggleClass(class_playing, false).toggleClass(class_loading, false);
				}
			}
		} else {
			$(selector_progress_indicator).css("width","0%"); // reset all indicators
			player.src = new_src;
			$(selector_playlink).closest(selector_track_holder).removeClass(class_playing).removeClass(class_active).removeClass(class_loading);
			par.toggleClass(class_loading, true).toggleClass(class_active, true);
			audio[0].load();
			if (is_paused != true) {
				audio[0].play();
				audio[0].addEventListener("timeupdate", function(e){
					var src_element = e.srcElement || e.target,
						percent_complete = 100 * (src_element.currentTime / src_element.duration),
						$activeLink = $(selector_active);
					$(selector_active + ' .' + class_progress_indicator).css("width", percent_complete + "%");
					if ($activeLink.hasClass(class_loading) && percent_complete > 0) {
						$activeLink.toggleClass(class_playing, true).toggleClass(class_loading,false);
					}
				});
			} else {
				par.toggle(class_playing, false);
			}
		}
	};

	var canSupportAudioAndMp3 = function() {
		var a = document.createElement('audio');
		return !!(a.canPlayType && a.canPlayType('audio/mpeg;').replace(/no/, ''));
	};

	var playPauseCurrentTrack = function(force_pause) {
		var link = $(selector_playlink)[current];
		run($(link), audio[0], (force_pause != true));
	};

	var stopAnyTracks = function() {
		audio[0].pause();
		$(selector_track_holder).removeClass(class_playing);
	};

	var stopAndClearPlayer = function() {
		stopAnyTracks();
		audio[0].src = "";
	};

	var stopOtherPlayers = function() {
		// specifically for jPlayer
		if ($(selector_widget_ap).length > 0 && $(selector_widget_ap).jPlayer) {
			$(selector_widget_ap).jPlayer("stop");
		}
	};

	var toggleAutoAdvance = function(isOn) {
		isOn = (isOn === null) ? !isAutoAdvanceOn : (isOn === true);
		isAutoAdvanceOn = isOn;
		return isOn;
	};

	return {
		init: init,
		canSupportAudioAndMp3: canSupportAudioAndMp3,
		playPauseCurrentTrack: playPauseCurrentTrack,
		stopAnyTracks: stopAnyTracks,
		stopAndClearPlayer: stopAndClearPlayer,
		toggleAutoAdvance: toggleAutoAdvance
	}
}());
