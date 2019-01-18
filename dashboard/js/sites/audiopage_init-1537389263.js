/* audiopage init 
requirements: jquery.js, audio_playlist.js
*/

$(function(){
	initAudioPlaylist();
	initAlbumUi();
});

var initAlbumUi = function() {
	$(".buy_album_button").on("click", function () {
		// no-op, hack to trick iOS into applying hover to this
	});
};

var loadMissingCssJs = function() {
	// font-awesome
	var fontAwesomePath = "/dashboard/css/font-awesome/css/font-awesome.min.css";
	var hasFontAwesomeCss = ($("link[href='" + fontAwesomePath + "']").length > 0);
	if (hasFontAwesomeCss == false) {
		$("<link href='" + fontAwesomePath + "' rel='stylesheet'>").appendTo("head");
	}
};

var initAudioPlaylist = function() {
	if (typeof AUDIO_PLAYLIST !== 'undefined' && AUDIO_PLAYLIST && AUDIO_PLAYLIST.canSupportAudioAndMp3() === true) {
		AUDIO_PLAYLIST.init();
		audioSetupReciprocalPlayPauseSetup();
		$('.inline-playable').on('contextmenu', function(e) {
			e.preventDefault();
		});
	} else {
		//$(".audio_support_warning").html("{{ trans('messages.alert_noaudiosupport') }}").show();
	}
};

var audioSetupReciprocalPlayPauseSetup = function() {
	// For reciprocal start/stopping between audio player and #jplayer(widgets)
	if($('#jplayer').length) { // #jplayer is the widget player currently
		$("#jplayer").off($.jPlayer.event.play);
		$("#jplayer").off($.jPlayer.event.pause);

		// Using 'bind' rather than .jPlayer({etc}) because of weird track-specific crashy behavior
		$("#jplayer").on($.jPlayer.event.play, function() {
			AUDIO_PLAYLIST.stopAnyTracks();
		});
	}
};

// immediate
loadMissingCssJs();
