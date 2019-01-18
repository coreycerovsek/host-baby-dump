/*
 * Playlist Object for the jPlayer Plugin
 * http://www.jplayer.org
 *
 * Copyright (c) 2009 - 2011 Happyworm Ltd
 * Dual licensed under the MIT and GPL licenses.
 *  - http://www.opensource.org/licenses/mit-license.php
 *  - http://www.gnu.org/copyleft/gpl.html
 *
 * Author: Mark J Panaghiston
 * Modified by: Jill Burrows and Kevin Stowell
 * Version: 2.3.0 (jPlayer 2.1.0)
 * Date: 13th March 2012
 *
 * Modified:
 *    2016, estastny
 *    2018, estastny, re deprecated bind/unbind calls, linting
 */

/* Code verified using http://www.jshint.com/ */
/*jshint asi:false, bitwise:false, boss:false, browser:true, curly:true, debug:false, eqeqeq:true, eqnull:false, evil:false, forin:false, immed:false, jquery:true, laxbreak:false, newcap:true, noarg:true, noempty:true, nonew:true, nomem:false, onevar:false, passfail:false, plusplus:false, regexp:false, undef:true, sub:false, strict:false, white:false */
/*global  jPlayerPlaylist: true, jQuery:false, alert:false */

// HOSTBABY CUSTOM, 20161004, updated 20170816, 20180716
$(function(){
	// audio widget scrolling fix for mobile; hides manual scrollbar and adjusts widths
	var isMobile = ("ontouchstart" in window
		|| navigator.maxTouchPoints);
	isMobile = isMobile && $("window").width() < 1025; // ipad landscape width
	if (isMobile && $(".jp-playlist").length > 0) {
		$(".jp-playlist")[0].addEventListener("refreshComplete", function(){
			$(this).find(".scroll-pane.scroll-pane-vertical").css("overflow","auto");
			$(this).find(".scroll-content-vertical.scroll-content.with-scrollbar,.scroll-pane.scroll-pane-vertical,.jp-playlist .with-scrollbar ul").css("width","100%");
			$(this).find(".scroll-bar-wrap-vertical").css("display","none");
		});
	}

	// is it IE11?
	if (!!window.MSInputMethodContext && !!document.documentMode) { // eslint-disable-line no-implicit-coercion
		$("head").append("<style>div.jp-header{height:50px;} div.jp-header .current-title {white-space:normal;}</style>");
	}
});

// Re IE8(--) versions
if (!Date.now) {
	Date.now = function() {
		return new Date().valueOf();
	};
}

(function($, undefined) {

	/**
	 * jPlayerPlaylist constructor
	 * ---------------------------
	 *
	 * Build the widget. Set up basic events.
	 */
	jPlayerPlaylist = function(cssSelector, playlist, options) {
		var self = this;

		this.loop = false; // Flag used with the jPlayer repeat event
		this.shuffled = false;
		this.removing = false; // Flag is true during remove animation, disabling the remove() method until complete.

		this.cssSelector = $.extend({}, this._cssSelector, cssSelector); // Object: Containing the css selectors for jPlayer and its cssSelectorAncestor
		this.options = $.extend(true, {}, this._options, options); // Object: The jPlayer constructor options for this playlist and the playlist options

		this.playlist = []; // Array of Objects: The current playlist displayed (Un-shuffled or Shuffled)
		this.original = []; // Array of Objects: The original playlist

		this._initPlaylist(playlist); // Copies playlist to this.original. Then mirrors this.original to this.playlist. Creating two arrays, where the element pointers match. (Enables pointer comparison.)

		// Setup the css selectors for the extra interface items used by the playlist.
		this.cssSelector.volume = this.cssSelector.cssSelectorAncestor + " .jp-volume";
		this.cssSelector.title = this.cssSelector.cssSelectorAncestor + " .jp-title"; // Note that the text is written to the decendant li node.
		this.cssSelector.currentTitle = this.cssSelector.cssSelectorAncestor + " .current-title";
		this.cssSelector.currentArtist = this.cssSelector.cssSelectorAncestor + " .current-artist";
		this.cssSelector.playlist = this.cssSelector.cssSelectorAncestor + " .jp-playlist";
		this.cssSelector.infoWrapper = this.cssSelector.cssSelectorAncestor + " .info-wrapper";
		this.cssSelector.next = this.cssSelector.cssSelectorAncestor + " .jp-next";
		this.cssSelector.previous = this.cssSelector.cssSelectorAncestor + " .jp-previous";
		this.cssSelector.shuffle = this.cssSelector.cssSelectorAncestor + " .jp-shuffle";
		this.cssSelector.shuffleOff = this.cssSelector.cssSelectorAncestor + " .jp-shuffle-off";
		this.cssSelector.facebook = this.cssSelector.cssSelectorAncestor + " .facebook";

		// Override the cssSelectorAncestor given in options
		this.options.cssSelectorAncestor = this.cssSelector.cssSelectorAncestor;

		this.title = {
			current: "",
			truncated: "",
			width: 0,
			containerWidth: $(this.cssSelector.currentTitle).parent().width(),
			overflow: 0
		};

		this.artist = {
			current: "",
			truncated: "",
			width: 0,
			containerWidth: $(this.cssSelector.currentArtist).parent().width(),
			overflow: 0
		};

		// Create the scroll pane
		this.scrollpane = {};

		// Override the default repeat event handler
		this.options.repeat = function(event) {
			self.loop = event.jPlayer.options.loop;
		};

		// Set up the ID for the player.
		this.playerDesignation = parseInt(Math.random() * 100000);

		this.playerTransition = false;

		this.usingFlash = false;

		this.track = {};

		// Set up the logic for determining what happens in each state transition
		this._setupTransitions();

		// Put the title in its initial display state
		if(!this.options.fullScreen) {
			$(this.cssSelector.title).hide();
		}

		// Creates the volume control
		$(this.cssSelector.volume).slider({
			value: parseInt(($.cookie("playerVolume") == null) ? 80 : $.cookie("playerVolume") * 100),
			max: 100,
			step: true,
			change: function(event, ui) {
				$(self.cssSelector.jPlayer).jPlayer("volume", ui.value / 100);
				self.track.volume = ui.value / 100;
				self._storeTrack();
			},
			slide: function(event, ui) {
				$(self.cssSelector.jPlayer).jPlayer("volume", ui.value / 100);
				self.track.volume = ui.value / 100;
				self._storeTrack();
			}
		});

		// Remove the empty <li> from the page HTML. Allows page to be valid HTML, while not interfereing with display animations
		$(this.cssSelector.playlist + " ul").empty();

		// Create .live() handlers for the playlist items along with the free media and remove controls.
		this._createItemHandlers();

		// Instance jPlayer
		$(this.cssSelector.jPlayer).jPlayer(this.options);
	};

	/**
	 * jPlayerPlaylist Prototype
	 */
	jPlayerPlaylist.prototype = {
		/**
		 * Default CSS selector values
		 */
		_cssSelector: { // static object, instanced in constructor
			jPlayer: "#jquery_jplayer_1",
			cssSelectorAncestor: "#jp_container_1"
		},
		/**
		 * Default options
		 */
		_options: { // static object, instanced in constructor
			playlistOptions: {
				"solution": "html, flash",
				"autoPlay": false,
				"active_track": -1,
				"loopOnPrevious": false,
				"shuffleOnLoop": true,
				"enableRemoveControls": false,
				"displayTime": "slow",
				"addTime": "fast",
				"removeTime": "fast",
				"shuffleTime": "slow",
				"itemClass": "jp-playlist-item",
				"freeGroupClass": "jp-free-media",
				"freeItemClass": "jp-playlist-item-free",
				"removeItemClass": "jp-playlist-item-remove"
			}
		},

		/**
		 * Setter for options
		 */
		option: function(option, value) { // For changing playlist options only
			if(value === undefined) {
				return this.options.playlistOptions[option];
			}

			this.options.playlistOptions[option] = value;

			switch(option) {
				case "enableRemoveControls":
					this._updateControls();
					break;
				case "itemClass":
				case "freeGroupClass":
				case "freeItemClass":
				case "removeItemClass":
					this._refresh(true); // Instant
					this._createItemHandlers();
					break;
			}
			return this;
		},

		/**
		 * Initializes values and does set-up after the player is ready
		 */
		_init: function() {
			var self = this;
			this._refresh();

			// Set-up the scroll pane.
			this.scrollpane = $(this.cssSelector.playlist).scrollbar({
				orientation: "vertical"
			});

			// Set up pointer for hover
			$(this.cssSelector.playlist + " ." + this.options.playlistOptions.itemClass).hover(
				function(){
					$(this).css({"cursor": "pointer"});
				},function(){
					$(this).css({"cursor": "pointer"});
				}
			);

			//init overflowing text animation
			self._initScrollText();
		},

		/**
		 * Set up the basic state of the playlist
		 */
		_initPlaylist: function(playlist) {
			this.shuffled = false;
			this.removing = false;
			this.original = $.extend(true, [], playlist); // Copy the Array of Objects
			this._originalPlaylist();
		},

		/**
		 * Copies the original playlist order into the playlist property
		 */
		_originalPlaylist: function() {
			var self = this;
			this.playlist = [];
			// Make both arrays point to the same object elements. Gives us 2 different arrays, each pointing to the same actual object. ie., Not copies of the object.
			$.each(this.original, function(i) {
				self.playlist[i] = self.original[i];
			});
		},

		/**
		 * Refreshes the playlist DOM
		 */
		_refresh: function(instant) {
			/* instant: Can be undefined, true or a function.
			 *	undefined -> use animation timings
			 *	true -> no animation
			 *	function -> use animation timings and excute function at half way point.
			 */
			var self = this;

			if(instant && !$.isFunction(instant)) {
				$(this.cssSelector.playlist + " ul").empty();
				$.each(this.playlist, function(i) {
					$(self.cssSelector.playlist + " ul").append(self._createListItem(self.playlist[i]));
				});
				this._updateControls();
			} else {
				var displayTime = $(this.cssSelector.playlist + " ul").children().length ? this.options.playlistOptions.displayTime : 0;

				$(this.cssSelector.playlist + " ul").hide(displayTime, function() {
					var $this = $(this);

					$this.empty();
					
					$.each(self.playlist, function(i) {
						$this.append(self._createListItem(self.playlist[i]));
					});
					self._updateControls();
					if($.isFunction(instant)) {
						instant();
					}
					if(self.playlist.length) {
						$this.show(self.options.playlistOptions.displayTime, function(){
							self._resizeScrollpane();
						});
					} else {
						$this.show();
						self._resizeScrollpane();
					}
				});
			}
		},

		/**
		 * Resize tasks
		 */
		_resizeScrollpane: function() {
			var hasDataScrollbar = this.scrollpane.data("scrollbar") != null;
			var hasDataUiScrollbar = this.scrollpane.data("uiScrollbar") != null; // concession for pjax/MoPi
			if (hasDataScrollbar) {
				this.scrollpane.data("scrollbar").resize();
			} else if (hasDataUiScrollbar) {
				this.scrollpane.data("uiScrollbar").resize();
			}

			// HOSTBABY CUSTOM, 20161004
			var event = new CustomEvent(
				"refreshComplete", 
				{
					bubbles: true,
					cancelable: true
				}
			);
			$(this.cssSelector.playlist)[0].dispatchEvent(event);
		},

		/**
		 * Create a playist item
		 */
		_createListItem: function(media) {
			var self = this;

			// Wrap the <li> contents in a <div>
			var listItem = "<li rel='track_id-" + media.postID + "' class='" + this.options.playlistOptions.itemClass + "'>";

			// Create remove control
			//listItem += "<a href='javascript:;' class='" + this.options.playlistOptions.removeItemClass + "'>&times;</a>";

			// Create links to free media
			if(media.free) {
				var first = true;
				listItem += "<span class='" + this.options.playlistOptions.freeGroupClass + "'>(";
				$.each(media, function(property,value) {
					if($.jPlayer.prototype.format[property]) { // Check property is a media format.
						if(first) {
							first = false;
						} else {
							listItem += " | ";
						}
						listItem += "<a class='" + self.options.playlistOptions.freeItemClass + "' href='" + value + "' tabindex='1'>" + property + "</a>";
					}
				});
				listItem += ")</span>";
			}

			// The title is given next in the HTML otherwise the float:right on the free media corrupts in IE6/7
			listItem += "<div class='info-wrapper'><span class='jp-track-title'>" + media.title + "</span></div>";
			listItem += "</li>";

			return listItem;
		},

		/**
		 * Create event handlers for each item in the playlist
		 */
		_createItemHandlers: function() {
			var self = this;

			// Create .live() handlers for the playlist items
			// This will run before _onPlay()
			$(this.cssSelector.playlist + " ." + this.options.playlistOptions.itemClass).die("click").live("click", function() {
				var index = $(this).index();
				self._onTrackClicked(index);
				$(this).blur();
				return false;
			});
		},

		/**
		 * Update the display of the controls
		 */
		_updateControls: function() {
			if(this.options.playlistOptions.enableRemoveControls) {
				$(this.cssSelector.playlist + " ." + this.options.playlistOptions.removeItemClass).show();
			} else {
				$(this.cssSelector.playlist + " ." + this.options.playlistOptions.removeItemClass).hide();
			}
			if(this.shuffled) {
				$(this.cssSelector.shuffleOff).show();
				$(this.cssSelector.shuffle).hide();
			} else {
				$(this.cssSelector.shuffleOff).hide();
				$(this.cssSelector.shuffle).show();
			}
		},

		/**
		 * Highlight the currently playling track
		 */
		_highlight: function(index) {
			if(this.playlist.length && index !== undefined) {
				$(this.cssSelector.playlist + " .jp-playlist-current").removeClass("jp-playlist-current");
				$(this.cssSelector.playlist + " li:nth-child(" + (index + 1) + ")").addClass("jp-playlist-current").find(".jp-playlist-item").addClass("jp-playlist-current");
				$(this.cssSelector.title + " li").html(this.playlist[index].title + (this.playlist[index].artist ? " <span class='jp-artist'>by " + this.playlist[index].artist + "</span>" : ""));
			}
		},

		/**
		 * Set an array to be used as the playlist
		 */
		setPlaylist: function(playlist) {
			this._initPlaylist(playlist);
			this._init();
		},

		/**
		 * Add a track to the playlist and DOM
		 */
		add: function(media, playNow) {
			$(this.cssSelector.playlist + " ul").append(this._createListItem(media)).find("li:last-child").hide().slideDown(this.options.playlistOptions.addTime);
			this._updateControls();
			this.original.push(media);
			this.playlist.push(media); // Both array elements share the same object pointer. Comforms with _initPlaylist(p) system.

			if (playNow) {
				this.play(this.playlist.length - 1);
			} else if (this.original.length === 1) {
				this.select(0);
			}
		},

		/**
		 * Remove a track from the playlist and DOM
		 */
		remove: function(index) {
			var self = this;

			if (index === undefined) {
				this._initPlaylist([]);
				this._refresh(function() {
					$(self.cssSelector.jPlayer).jPlayer("clearMedia");
				});
				return true;
			} else if (this.removing) {
				return false;
			} else {
				index = (index < 0) ? self.original.length + index : index; // Negative index relates to end of array.
				if(0 <= index && index < this.playlist.length) {
					this.removing = true;

					$(this.cssSelector.playlist + " li:nth-child(" + (index + 1) + ")").slideUp(this.options.playlistOptions.removeTime, function() {
						$(this).remove();

						if(self.shuffled) {
							var item = self.playlist[index];
							$.each(self.original, function(i) {
								if(self.original[i] === item) {
									self.original.splice(i, 1);
									return false; // Exit $.each
								}
							});
							self.playlist.splice(index, 1);
						} else {
							self.original.splice(index, 1);
							self.playlist.splice(index, 1);
						}

						if(self.original.length) {
							if(index === self.track.current) {
								self.track.current = (index < self.original.length) ? self.track.current : self.original.length - 1; // To cope when last element being selected when it was removed
								self.select(self.track.current);
							} else if(index < self.track.current) {
								self.track.current--;
							}
						} else {
							$(self.cssSelector.jPlayer).jPlayer("clearMedia");
							self.track.current = 0;
							self.shuffled = false;
							self._updateControls();
						}

						self.removing = false;
					});
				}
				return true;
			}
		},

		/**
		 * Select a specific track
		 */
		select: function(index) {
			index = (index < 0) ? this.original.length + index : index; // Negative index relates to end of array.
			if(0 <= index && index < this.playlist.length) {
				this.track.current = index;
				this._highlight(index);
				this._updateTrackInfo(index);
				$(this.cssSelector.jPlayer).jPlayer("setMedia", this.playlist[this.track.current]);
			} else {
				this.track.current = 0;
			}
			// Update stored cookie.
			this._storeTrack();
		},

		/**
		 * Play a specific track starting at the current time.
		 */
		play: function(index) {
			$(this).jPlayer("pauseOthers");
			if(index != undefined) {
				index = (index < 0) ? this.original.length + index : index; // Negative index relates to end of array.
				if(0 <= index && index < this.playlist.length) {
					if(this.playlist.length) {
						this.track.time = 0.0;
						this.track.playing = true;
						this.select(index);
					}
				}
			}
			$(this.cssSelector.jPlayer).jPlayer("play", this.track.time);
		},

		/**
		 * Pause the player
		 */
		pause: function() {
			$(this.cssSelector.jPlayer).jPlayer("pause");
		},

		/**
		 * Stop the player
		 */
		stop: function() {
			$(this.cssSelector.jPlayer).jPlayer("stop");
		},

		/**
		 * Advance to the next track
		 */
		next: function() {
			var index = (this.track.current + 1 < this.playlist.length) ? this.track.current + 1 : 0;
			this.track.time = 0.0;

			if(this.loop) {
				// See if we need to shuffle before looping to start, and only shuffle if more than 1 item.
				if(index === 0 && this.shuffled && this.options.playlistOptions.shuffleOnLoop && this.playlist.length > 1) {
					this.shuffle(true, true); // playNow
				} else {
					this.play(index);
				}
			} else if (index > 0) { // The index will be zero if it just looped round
				this.play(index);
			}
		},

		/**
		 * Move to the previous track
		 */
		previous: function() {
			var index = (this.track.current - 1 >= 0) ? this.track.current - 1 : this.playlist.length - 1;
			this.track.time = 0.0;

			if(this.loop && this.options.playlistOptions.loopOnPrevious || index < this.playlist.length - 1) {
				this.play(index);
			}
		},

		/**
		 * Shuffles the songs in the playlist
		 * (e.g.: randomizes order of the playlist)
		 */
		shuffle: function(shuffled, playNow) {
			var self = this;

			if(shuffled === undefined) {
				shuffled = !this.shuffled;
			}

			if(shuffled || shuffled !== this.shuffled) {
				this.track.time = 0.0;
				$(this.cssSelector.playlist + " ul").slideUp(this.options.playlistOptions.shuffleTime, function() {
					self.shuffled = shuffled;
					if(shuffled) {
						self.playlist.sort(function() {
							return 0.5 - Math.random();
						});
					} else {
						self._originalPlaylist();
					}
					self._refresh(true); // Instant

					if(playNow || !$(self.cssSelector.jPlayer).data("jPlayer").status.paused) {
						self.play(0);
					} else {
						self.select(0);
					}

					$(this).slideDown(self.options.playlistOptions.shuffleTime);
				});
			}
		},

		/**
		 * Initialize all the handlers related to scrolling truncated text
		 */
		_initScrollText: function () {
			var self = this;
			$(".jp-track-title").each(function(idx){
				self.scrollTextHandler(this, self.playlist[idx].title);
			});

			$(this.cssSelector.currentTitle).hover(
				function() {
					var e = $(this);
					if(self.title.overflow > 0) {
						self.animateLeft(e, self.playlist[self.track.current].title, self.title.overflow);
					}
				},
				function() {
					var e = $(this);
					self.animateRight(e, self.title.truncated);
				}
			);

			$(this.cssSelector.currentArtist).hover(
				function() {
					var e = $(this);
					if(self.artist.overflow > 0) {
						self.animateLeft(e, self.playlist[self.track.current].artist, self.artist.overflow);
					}
				},
				function() {
					var e = $(this);
					self.animateRight(e, self.artist.truncated);
				}
			);
		},

		/**
		 * Update the currently playing track display and state info
		 */
		_updateTrackInfo: function(index) {
			var e;
			// If we have title info, update it
			if(this.playlist[index].title){
				e = $(this.cssSelector.currentTitle);
				e.text(this.playlist[index].title);
				this.title.current = this.playlist[index].title;
				this.title.width = e.width();
				this.title.overflow = this.title.width - this.title.containerWidth;
				this.title.truncated = this._truncateDisplay(this.title.current, this.title.overflow);
				e.html(this.title.truncated);
			}

			// If we have artist info, update it
			if(this.playlist[index].artist){
				e = $(this.cssSelector.currentArtist);
				e.text(this.playlist[index].artist);
				this.artist.current = this.playlist[index].artist;
				this.artist.width = e.width();
				this.artist.overflow = this.artist.width - this.artist.containerWidth;
				this.artist.truncated = this._truncateDisplay(this.artist.current, this.artist.width);
				e.html(this.artist.truncated);
			}
		},

		/**
		 * Handler for mouse hovers on truncted text
		 */
		scrollTextHandler: function(elem, str) {
			var self = this;
			var e = $(elem);
			var originalString = str;
			// Caluclate the distance to scroll the item
			var overflow = e.width() - e.parent().width();
			// Truncate if needed
			var slicedString = this._truncateDisplay(originalString, overflow);
			e.html(slicedString);

			if (overflow > 0) {
				// Set up closures for handling mouse over/out events.
				e.hover(
					function(){
						self.animateLeft(e, originalString, overflow);
					},
					function(){
						self.animateRight(e, slicedString);
					}
				);
			}
		},

		/**
		 * Slide the content out
		 * Uses a duration the increases linearly with the length of the content
		 */
		animateLeft: function (e, originalString, distance) {
			// Calculate the duration of the animation linearly based on the total distance
			var duration = distance * 20; // 16 seems to be a really nice speed! :-D
			var t = setTimeout(function(){
				e.html(originalString);
				e.animate(
					{
						"left": -distance
					},
					{
						queue: false,
						duration:duration
					}
				);
			}, 1000);
			e.data("timeout", t);
		},

		/**
		 * Slide the content back in
		 */
		animateRight: function (e, slicedString) {
			if(e.data("timeout")) {
				clearTimeout(e.data("timeout"));
			}
			e.stop().animate(
				{
					"left": 0
				},
				{
					queue: false,
					complete: function(){
						e.html(slicedString);
					}
				}
			);
		},

		/**
		 * If need be:
		 * Truncates the data.current value
		 * Stores result in data.truncated
		 * @param data
		 */
		_truncateDisplay: function(originalString, overflow) {
			var truncated = originalString;
			if (overflow <= 0) {
				overflow = 0;
			} else if (originalString.length > 17) {
				truncated = originalString.slice(0,17);//This is a fixed width - b/c all of our player dimensions are the same.
				truncated += "...";
			}
			return truncated;
		},

		/**
		 * Share the currently playing track on Facebook
		 */
		facebookShare: function () {
			var shareURL = this.playlist[this.track.current].shareURL;
			var title = "Share this track on Facebook";
			var fbShare = "http://www.facebook.com/sharer.php?u=" + encodeURIComponent(shareURL) + "&t=" + encodeURIComponent(title);

			// show dialog to share
			window.open(fbShare,"ShareOnFB",
				"left=20,top=20,width=670,height=500,toolbar=0,location=0,directories=0,status=0,menubar=0");
		},

		/**
		 * Setup state transition events.
		 */
		_setupTransitions: function () {
			var self = this;
			// Create a ready event handler to initialize the playlist
			$(this.cssSelector.jPlayer).on($.jPlayer.event.ready, function(event) {
				// Are we using flash? Documentation is wrong it's not "unknown" it's "n/a"
				self.usingFlash = (event.jPlayer.version.flash != "n/a");
				// Call the playlist init for everything that should run after the jPlayer is ready
				self._init();
				//store Info vars
				self._syncPlayerWithCookie();
				if ( self.track.active.valueOf() != self.playerDesignation.valueOf() ) {
					self._otherPlayerActive();
				}
				self._playOnStart();
			});

			// Create a play event handler to pause other instances and sync with stored data
			$(this.cssSelector.jPlayer).on($.jPlayer.event.play, function() {
				self._onPlay();
			});

			// Create an ended event handler to move to the next item
			$(this.cssSelector.jPlayer).on($.jPlayer.event.ended, function() {
				self.next();
			});

			// Handler for pausing a track
			$(this.cssSelector.jPlayer).on($.jPlayer.event.pause, function() {
				self.track.playing = false;
				self._storeTrack();
			});

			// Handler for an aborted track
			$(this.cssSelector.jPlayer).on($.jPlayer.event.abort, function() {
				// Do nothing...
			});

			// Create a resize event handler to show the title in full screen mode.
			$(this.cssSelector.jPlayer).on($.jPlayer.event.resize, function(event) {
				if(event.jPlayer.options.fullScreen) {
					$(self.cssSelector.title).show();
				} else {
					$(self.cssSelector.title).hide();
				}
			});

			// Handler for updating time, checks if another player has gone active, synchronizes players
			$(this.cssSelector.jPlayer).on($.jPlayer.event.timeupdate, function(event) {
				if ( event.jPlayer.status.currentTime != 0.0 ){
					self.track.time = event.jPlayer.status.currentTime;
				}
				self.track.volume = parseFloat(($.cookie("playerVolume") == null) ? 0.8 : $.cookie("playerVolume"));
				$(self.cssSelector.jPlayer).jPlayer("volume", self.track.volume);
				$(self.cssSelector.volume).slider("value", parseInt(self.track.volume * 100));
				self._storeTrack();
			});

			// Create click handlers for the extra buttons that do playlist functions.
			$(this.cssSelector.previous).click(function() {
				self.previous();
				$(this).blur();
				return false;
			});

			// move to the next song
			$(this.cssSelector.next).click(function() {
				self.next();
				$(this).blur();
				return false;
			});

			// Shuffle playlist
			$(this.cssSelector.shuffle).click(function() {
				self.shuffle(true);
				return false;
			});

			// Unshuffle playlist
			$(this.cssSelector.shuffleOff).click(function() {
				self.shuffle(false);
				return false;
			}).hide();

			// Set up the handler for the facebook share button
			$(this.cssSelector.facebook).on("click", function(e) {
				e.preventDefault();
				self.facebookShare();
			});

			// focus handler for IE
			if($.browser.msie){
				$(document).on("focusin", function(e) {
					if(e.target == document) {
						self._onFocus();
					}
				});
			}

			// focus handler for other browsers
			$(window).on("focus", function () {
				self._onFocus();
			});

			// On unload, store player state. If active, remove active status.
			$(window).unload(function () {
				self._onUnload();
			});

		},

		_playOnStart: function() {
			if( this._shouldPlayOnStart() || (this.options.active_track > -1)) {
				this._setActivePlayer();
				if (this.options.active_track > -1) {
					var self = this;
					$(self.cssSelector.playlist + " ul li").each(function (k) {
						if ($(this).attr("rel") == "track_id-" + self.options.active_track) {
							self.track.current = k;
							return false;
						}
					});
					// Play the new track
					this.play(this.track.current);
				} else {
					// Just start playing the stored track at whatever time offset we have.
					this.select(this.track.current);
					this.play();
				}
			} else {
				this.select(this.track.current);
			}
		},

		/**
		 * Rules for determining if the player should start on init
		 */
		_shouldPlayOnStart: function () {
			var activePlayer = this.track.active == null ? 0 : this.track.active;
			return (this.options.playlistOptions.autoPlay || this.track.playing) && ( activePlayer.valueOf() === this.playerDesignation.valueOf() );
		},

		/**
		 * Rules for what happens when another player is active
		 */
		_otherPlayerActive: function () {
			if($(".jp-interface").find(".player-inactive").length == 0 ) {
				$(".jp-interface").append($("<div class=\"player-inactive\" style=\"font-size:11px;height:40px;margin-bottom:4px;overflow:hidden;padding: 1px;position:absolute;right:5px;top:5px;width:131px;\">This player is sleeping. Press play to wake it up.</div>"));
				$(".jp-progress").hide();
				$(".jp-current-time").hide();
				$(".jp-duration").hide();
				$(".jp-volume").hide();
			}
		},

		/**
		 * Rules for what happens when this player is activated
		 */
		_activatePlayer: function () {
			$(".player-inactive").remove();
			$(".jp-progress").show();
			$(".jp-current-time").show();
			$(".jp-duration").show();
			$(".jp-volume").show();
		},

		/**
		 * Rules for what happens when an individual track is clicked
		 * @param index
		 */
		_onTrackClicked: function (index) {
			this._syncPlayerWithCookie();
			this.playerTransition = this._setActivePlayer();
			if (this.track.current === index) {
				this.select(this.track.current);
				this.play();
			} else {
				if(this.usingFlash) {
					this.stop();
				}
				this.stop();
				this.play(index);
			}
		},

		/**
		 * Rules for interacting with other players on play
		 */
		_onPlay: function () {
			/*
			 * If
			 * 		there is no active player (because someone closed a tab or window)
			 * or
			 * 		we are transitioning from another active player
			 * then synchronize player with last player.
			 */
			if( this._setActivePlayer() || this.playerTransition ) {
				this.playerTransition = false;
				if(this.usingFlash) {
					this.stop();
				}
				// Sync with cookie.
				this._syncPlayerWithCookie();
				this.select(this.track.current);
				this.play();
			}
			this.track.playing = true;
			this._storeTrack();
		},

		/**
		 * Rules for what happens on focus
		 */
		_onFocus: function () {
			var self = this;
			self._syncPlayerWithCookie();
			if ( self.track.active.valueOf() != self.playerDesignation.valueOf() ) {
				self._otherPlayerActive();
				// If we wanted to auto play on focus...
				/*self._setActivePlayer();
				if(self.track.playing) {
					self.select(self.track.current);
					self.play();
				}*/
			}

		},

		/**
		 * Unload handler
		 */
		_onUnload: function () {
			var self = this;
			self._storeTrack();
			self._removeFromOpenPlayers();
		},

		/**
		 * Synchronize the current player status with the cookie
		 */
		_syncPlayerWithCookie: function () {
			// Load all needed values into the player state
			this.track = {
				time: parseFloat(($.cookie("playerTime") == null) ? 0.0 : $.cookie("playerTime")),
				volume: parseFloat(($.cookie("playerVolume") == null) ? 0.8 : $.cookie("playerVolume")),
				current: parseInt(($.cookie("playerTrack") == null) ? 0 : $.cookie("playerTrack")),
				playing: Boolean(parseInt(($.cookie("playerPlaying") == null) ? 0 : $.cookie("playerPlaying"))),
				active: parseInt(($.cookie("playerActivePlayer") == null) ? this.playerDesignation : $.cookie("playerActivePlayer"))
			};
		},

		/**
		 * Store the current playing track and time offset.
		 */
		_storeTrack: function(){
			var self = this;
			if( this._isActivePlayer() ) {
				// set values
				$.cookie("playerTime", this.track.time, this._getCookieOptions());
				$.cookie("playerVolume", this.track.volume, this._getCookieOptions());
				$.cookie("playerTrack", this.track.current, this._getCookieOptions());
				$.cookie("playerPlaying", ( (this.track.playing == false) ? 0 : 1 ), this._getCookieOptions());
				$.cookie("playerActivePlayer", this.track.active, this._getCookieOptions());
			} else {
				setTimeout(function() {
					$(self.cssSelector.jPlayer).jPlayer("pause");
				}, 10);
			}
		},

		/**
		 * Gets the currently stated active player
		 */
		_isActivePlayer: function () {
			this.track.active = parseInt( $.cookie("playerActivePlayer") );
			return ( this.track.active.valueOf() === this.playerDesignation.valueOf() );
		},

		/**
		 * Deativates the current
		 */
		_deactivateIfActive: function () {
			if(this._isActivePlayer()){
				$.cookie("playerActivePlayer", null, this._getCookieOptions());
			}
		},

		/**
		 * Sets this player as the active player
		 * Called by a player when a user actively clicks play
		 * This status is checked by a player during the playing event,
		 *   if the player is no longer active it stops.
		 * If the cookie state transitioned, returns true.
		 */
		_setActivePlayer: function () {
			var isActive = this._isActivePlayer();
			$.cookie("playerActivePlayer", this.playerDesignation, this._getCookieOptions());
			$(this.cssSelector.volume).slider("value", parseInt(this.track.volume * 100));
			var transitioning = !(isActive == this._isActivePlayer());
			this._activatePlayer();
			return transitioning;
		},

		/**
		 * Removes the current player from the list of open players
		 */
		_removeFromOpenPlayers: function () {
			this._deactivateIfActive();
		},

		/**
		 * Returns the cookie options needed to save state consistently
		 */
		_getCookieOptions: function () {
			// expire in an hour
			var exp = new Date(Date.now() + (60 * 60 * 1000));
			var cookieOpts = {
				expires: exp,
				path: "/"
			};
			return cookieOpts;
		}
	};

	// helper for ie>9
	(function () {
		if ( typeof window.CustomEvent === "function" ) {
			return false;
		}
		var CustomEvent = function( event, params ) {
			params = params || { bubbles: false, cancelable: false, detail: undefined };
			var evt = document.createEvent("CustomEvent");
			evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
			return evt;
		};
		CustomEvent.prototype = window.Event.prototype;
		window.CustomEvent = CustomEvent;
	})();
})(jQuery);
