/* Javascript document
 *
 * @Author:	Ken Stowell
 * @Date:
 *
 * @Description: View Object for user themes
 */

/**********************************************************************************************************************************************************
 * GLOBAL VARS/FUNCTIONS																																																																	*
 *********************************************************************************************************************************************************/

/**********************************************************************************************************************************************************
 *	Theme
 **********************************************************************************************************************************************************
 *
 * @desc: Main scripting resource for user themes.
 *
 *
 *
 *
 */
(function () {
	/**
	 * THEME CONSTRUCTOR
	 */
	var Theme = function () {
		this.init();
	};

	/**
	 * THEME OBJECT METHODS
	 */
	Theme.prototype = {
		/**
		 * INIT
		 */
		init:function () {
			//load dynamic page elements
			this.buildPage();

			//load dynamic page elements
			this.bindEvents();
		},
		/**
		 * BUILD PAGE
		 */
		buildPage:function () {
			var self = this;

			/**
			 * Document Ready
			 * @desc: any dynamic DOM manipulation goes here.
			 */
			$(document).ready(function () {
				// Inject a unique identifier for special links
				// for the Theme Editor
				self.handleImageLinks();

				// Get rid of old <object> tags
				self.replaceObjectElements();

				// Make iframes IE friendly
				self.ieFriendlyFrames();

				// Make visible only pagination elements that have children
				if ($("#pagination").children().length > 0) {
					$("#pagination").css("display","block");
				}

				/* Audio page specific stuff, but here to avoid extra script loads */
				self.initAudioPage();
			});

			/**
			 * Window Load
			 */
			$(window).load(function () {

			});
		},

		/**
		* INIT AUDIO PAGE
		* Usually happens at page load, but can happen after pjax on some themes
		*/
		initAudioPage: function() {
			// For audio page, add toggle events for lyrics open/close
			$("a.lyrics_toggle").click(function() {
				$("#lyrics_" + $(this).attr("data-trackid")).toggle();
				return false;
			});
		},

		/**
		 * BIND EVENTS
		 *
		 */
		bindEvents: function() {
		},
		/**
		 * -------------------
		 * HANDLE IMAGE LINKS
		 * -------------------
		 */
		handleImageLinks: function() {
			// For each image that is teh direct child of an anchor tag
			// inject indentifier
			$("a").each(function() {
				if ($(this).children("img").length >= 1) {
					$(this).addClass("image-link");
				}
			});
		},
		/**
		 * -------------------
		 * IE FRIENDLY IFRAMES
		 * -------------------
		 * @desc: searches DOM for iframes, adds wmode=transparent attribute
		 */
		ieFriendlyFrames: function() {
			// Add wmode trans to iframe for users so their youtoobs don't get meesed up
			$("iframe").each(function() {
				try {
					if ($(this).attr("src").match(/youtube/i)) {
						// seems like we dont need to change &amp; to &, this site seems to think that you can leave that...
						// http://www.jenkaufman.com/youtube-iframe-embed-video-problem-hides-menus-other-layers-546/
						// var src  = $(this).attr("src").replace(/&amp;/gi, "&"); // if we do in fact need to swap &amp; to &
						var src = $(this).attr("src");
						$(this).attr("src", src + (src.match(/\?/) ? "&" : "?") + "wmode=transparent");
					}
				} catch(e) {
					// no-op
				}
			});
		},
		/**
		 * -----------------------
		 * REPLACE OBJECT ELEMENTS
		 * -----------------------
		 * @desc: strips source URLs from antiquated object elements and replaces them with an iframe
		 */
		replaceObjectElements: function() {
			// Add wmode transparent to legacy youtube object and embed
			var obj = $("object"); // Get all object tags on the page
			var objectParent; // Object parent element used in appending

			// Get obejcts
			for(var i = 0; i < obj.length; i++) {
				// Parent
				objectParent = $(obj[i]).parent("p");
				// Current object child elements
				var chldrn = obj[i].childNodes;
				// Get children
				for(var j = 0; j < chldrn.length; j++) {
					if(chldrn[j].tagName == "PARAM") {
						if( chldrn[j].value.match(/youtube/i) || chldrn[j].value.match(/vimeo/i) ) {

							// Get URl from param element
							var url = chldrn[j].value;
							url = url.replace(/\/v\//gi, "/embed/");

							// Now search for the object for options
							var width = $(obj[i]).attr("width");
							var height = $(obj[i]).attr("height");

							// Build new iframe with correct URL
							var iframe 	= 	"<iframe frameborder=\"0\" width=\"" + width + "\" height=\"" + height + "\" src=\"" + url + "\"></iframe>";

							// Remove the <object/>
							$(obj[i]).remove();

							// inject the iframe back into its wrapper
							$(objectParent).prepend(iframe);
						}
					}	else if(chldrn[j].tagName === "EMBED") {
						$(chldrn[j]).attr("wmode", "transparent");
					}
				}
			}
		}
	};
	//instantiate the object and push it to the window object
	window.mytheme = new Theme();
})(window);

/************************************************************* END ***************************************************************************************/

