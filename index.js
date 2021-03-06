/*****************************************************************************
* Copyright (c) 2015 Branza Victor-Alexandru <branza.alex[at]gmail.com>
*
* This program is free software; you can redistribute it and/or modify it
* under the terms of the GNU Lesser General Public License as published by
* the Free Software Foundation; either version 2.1 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public License
* along with this program; if not, write to the Free Software Foundation,
* Inc., 51 Franklin Street, Fifth Floor, Boston MA 02110-1301, USA.
*****************************************************************************/

// WebChimera.js Player v0.4.4

var vlcs = {},
	opts = {},
	players = {},
	$ = require('jquery'),
	seekDrag = false,
	volDrag = false,
	firstTime = true,
	http = require('http'),
	events = require('events'),
	path = require('path'),
	sleepId;
	
try {
    var powerSaveBlocker = require('remote').require('power-save-blocker');
} catch (ex) {
	var sleep = require('./dst/computer-sleep/sleep.js');
}

require('./dst/jquery-ui/sortable');

var relbase = "/"+path.relative(path.dirname(require.main.filename), __dirname);


if (!$("link[href='"+relbase+"/public/general.css']").length) {
	// inject stylesheet
	$('<link href="'+relbase+'/public/general.css" rel="stylesheet">').appendTo("head");
	
	// inject scrollbar css
	window.document.styleSheets[0].addRule('.wcp-menu-items::-webkit-scrollbar','width: 44px !important;');
	window.document.styleSheets[0].addRule('.wcp-menu-items::-webkit-scrollbar-track','background-color: #696969 !important; border-right: 13px solid rgba(0, 0, 0, 0); border-left: 21px solid rgba(0, 0, 0, 0); background-clip: padding-box; -webkit-box-shadow: none !important;');
	window.document.styleSheets[0].addRule('.wcp-menu-items::-webkit-scrollbar-thumb','background-color: #e5e5e5; border-right: 13px solid rgba(0, 0, 0, 0); border-left: 21px solid rgba(0, 0, 0, 0); background-clip: padding-box; -webkit-box-shadow: none !important;');
	window.document.styleSheets[0].addRule('.wcp-menu-items::-webkit-scrollbar-thumb:hover','background-color: #e5e5e5 !important; border-right: 13px solid rgba(0, 0, 0, 0); border-left: 21px solid rgba(0, 0, 0, 0); background-clip: padding-box; -webkit-box-shadow: none !important;');
	window.document.styleSheets[0].addRule('.wcp-menu-items::-webkit-scrollbar-thumb:active','background-color: #e5e5e5 !important; border-right: 13px solid rgba(0, 0, 0, 0); border-left: 21px solid rgba(0, 0, 0, 0); background-clip: padding-box; -webkit-box-shadow: none !important;');
}

// deinitializate when page changed
window.onbeforeunload = function(e) {
	// stop all players
	for (var wjs_target in players) if (players.hasOwnProperty(wjs_target)) {
		if (players[wjs_target].vlc) players[wjs_target].vlc.stop();
	}
	// clear wcjs-player from require cache when page changes
	if (global.require.cache) {
		for(module in global.require.cache) {
			if(global.require.cache.hasOwnProperty(module) && module.indexOf("wcjs-player") > -1) {
				delete global.require.cache[module];
			}
		}
	} else if (require.cache) {
		for(module in require.cache) {
			if(require.cache.hasOwnProperty(module) && module.indexOf("wcjs-player") > -1) {
				delete require.cache[module];
			}
		}
	}
}

function wjs(context) {
	
	this.version = "v0.4.4";

	// Save the context
	this.context = (typeof context === "undefined") ? "#webchimera" : context;  // if no playerid set, default to "webchimera"
	
	if (hasClass($(this.context)[0],"webchimeras")) this.context = "#"+$(this.context).find(".wcp-wrapper")[0].id;
	
	if (this.context.substring(0,1) == "#") {
		if (window.document.getElementById(this.context.substring(1)).firstChild) {
			this.wrapper = window.document.getElementById(this.context.substring(1));
			this.canvas = this.wrapper.firstChild.firstChild;
			this.wrapper = $(this.wrapper);
		}
		this.allElements = [window.document.getElementById(this.context.substring(1))];
	} else {
		if (this.context.substring(0,1) == ".") this.allElements = window.document.getElementsByClassName(this.context.substring(1));
		else this.allElements = window.document.getElementsByTagName(this.context);
		this.wrapper = this.allElements[0];
		this.canvas = this.wrapper.firstChild.firstChild;
		this.wrapper = $(this.wrapper);
	}
	if (vlcs[this.context]) {
		this.vlc = vlcs[this.context].vlc;
		this.renderer = vlcs[this.context].renderer;
	}
	return this;
};

wjs.prototype.toggleMute = function() {
	if (!this.vlc.mute) players[this.context].mute(true);
	else players[this.context].mute(false);
	return this;
};

wjs.prototype.togglePause = function() {
	if (!this.vlc.playing) {
		wjs_button = this.wrapper.find(".wcp-play");
		if (wjs_button.length != 0) {
			wjs_button.removeClass("wcp-play").addClass("wcp-pause");
			switchClass(this.wrapper.find(".wcp-anim-basic")[0],"wcp-anim-icon-pause","wcp-anim-icon-play");
		}
		
		wjs_button = this.wrapper.find(".wcp-replay");
		if (wjs_button.length != 0) {
			wjs_button.removeClass("wcp-replay").addClass("wcp-pause");
			switchClass(this.wrapper.find(".wcp-anim-basic")[0],"wcp-anim-icon-pause","wcp-anim-icon-play");
		}
		
		if (this.vlc.playlist.itemCount > 0) this.vlc.playlist.play();
	} else {
		this.wrapper.find(".wcp-pause").removeClass("wcp-pause").addClass("wcp-play");
		switchClass(this.wrapper.find(".wcp-anim-basic")[0],"wcp-anim-icon-play","wcp-anim-icon-pause");
		this.vlc.playlist.pause();
	}
	return this;
};

wjs.prototype.play = function(mrl) {
	if (!this.vlc.playing) {
		switchClass(this.wrapper.find(".wcp-anim-basic")[0],"wcp-anim-icon-pause","wcp-anim-icon-play");

		wjs_button = this.wrapper.find(".wcp-play");
		if (wjs_button.length != 0) wjs_button.removeClass("wcp-play").addClass("wcp-pause");
		
		wjs_button = this.wrapper.find(".wcp-replay");
		if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-pause");
		
		if (mrl) this.vlc.play(mrl);
		else if (this.vlc.playlist.itemCount > 0) this.vlc.playlist.play();
	}
	return this;
};

wjs.prototype.pause = function() {
	if (this.vlc.playing) {
		switchClass(this.wrapper.find(".wcp-anim-basic")[0],"wcp-anim-icon-play","wcp-anim-icon-pause");
		this.wrapper.find(".wcp-pause").removeClass("wcp-pause").addClass("wcp-play");
		this.vlc.playlist.pause();
	}
	return this;
};

wjs.prototype.playItem = function(i) {
	if (typeof i !== 'undefined') {
		if (i != this.vlc.playlist.currentItem) {
			if (i < this.vlc.playlist.itemCount && i > -1) {
				if (wjsPlayer.vlc.playlist.items[i].disabled) {
					wjsPlayer.vlc.playlist.items[i].disabled = false;
					if (this.wrapper.find(".wcp-playlist").is(":visible")) {
						this.wrapper.find(".wcp-playlist-items:eq("+i+")").removeClass("wcp-disabled");
					}
					this.wrapper.find(".wcp-playlist").find(".wcp-menu-selected").removeClass("wcp-menu-selected");
					this.wrapper.find(".wcp-playlist-items:eq("+i+")").addClass("wcp-menu-selected");
				}
				opts[this.context].keepHidden = true;
				players[this.context].zoom(0);
				
				wjs_button = this.wrapper.find(".wcp-play");
				if (wjs_button.length != 0) wjs_button.removeClass("wcp-play").addClass("wcp-pause");
				
				wjs_button = this.wrapper.find(".wcp-replay");
				if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-pause");
		
				this.vlc.playlist.playItem(i);
		
				positionChanged(this,0);
				this.wrapper.find(".wcp-time-current").text("");
				this.wrapper.find(".wcp-time-total").text("");
			}
		}
	} else return false;
	return this;
};

wjs.prototype.stop = function() {
	wjs_button = this.wrapper.find(".wcp-pause");
	if (wjs_button.length != 0) wjs_button.removeClass("wcp-pause").addClass("wcp-play");

	wjs_button = this.wrapper.find(".wcp-replay");
	if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-play");

	this.vlc.playlist.stop();
		
	positionChanged(this,0);
	this.wrapper.find(".wcp-time-current").text("");
	this.wrapper.find(".wcp-time-total").text("");
	return this;
};

wjs.prototype.next = function() {
	if (this.vlc.playlist.currentItem +1 < this.vlc.playlist.itemCount) {
		
		var noDisabled = true;
		for (i = this.vlc.playlist.currentItem +1; i < this.vlc.playlist.itemCount; i++) {
			if (!this.vlc.playlist.items[i].disabled) {
				noDisabled = false;
				break;
			}
		}
		if (noDisabled) return false;
		
		opts[this.context].keepHidden = true;
		players[this.context].zoom(0);
		
		wjs_button = this.wrapper.find(".wcp-play");
		if (wjs_button.length != 0) wjs_button.removeClass("wcp-play").addClass("wcp-pause");
	
		wjs_button = this.wrapper.find(".wcp-replay");
		if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-pause");
	
		this.vlc.playlist.next();
		
		positionChanged(this,0);
		this.wrapper.find(".wcp-time-current").text("");
		this.wrapper.find(".wcp-time-total").text("");
		return this;
	} else return false;
};

wjs.prototype.prev = function() {
	if (this.vlc.playlist.currentItem > 0) {
		
		var noDisabled = true;
		for (i = this.vlc.playlist.currentItem -1; i > -1; i--) {
			if (!this.vlc.playlist.items[i].disabled) {
				noDisabled = false;
				break;
			}
		}
		if (noDisabled) return false;

		opts[this.context].keepHidden = true;
		players[this.context].zoom(0);
		
		wjs_button = this.wrapper.find(".wcp-play");
		if (wjs_button.length != 0) wjs_button.removeClass("wcp-play").addClass("wcp-pause");
	
		wjs_button = this.wrapper.find(".wcp-replay");
		if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-pause");
	
		this.vlc.playlist.prev();
		
		positionChanged(this,0);
		this.wrapper.find(".wcp-time-current").text("");
		this.wrapper.find(".wcp-time-total").text("");
		return this;
	} else return false;
};

wjs.prototype.addPlayer = function(wcpSettings) {
	
	if (wcpSettings) newid = (typeof wcpSettings["id"] === "undefined") ? "webchimera" : wcpSettings["id"]; // if no id set, default to "webchimera"
	else newid = "webchimera";
	
	if (window.document.getElementById(newid) !== null) {
		for (i = 2; window.document.getElementById(newid +i) !== null; i++) { }
		newid = newid +i;
	}
	
	if (typeof newid === 'string') {
		if (newid.substring(0,1) == "#") var targetid = ' id="'+newid.substring(1)+'" class="wcp-wrapper"';
		else if (newid.substring(0,1) == ".") { var targetid = ' id="webchimera" class="'+newid.substring(1)+' wcp-wrapper"'; newid = "#webchimera"; }
		else { var targetid = ' id="'+newid+'" class="wcp-wrapper"'; newid = "#"+newid; }
	} else { var targetid = ' id="webchimera" class="wcp-wrapper"'; newid = "#webchimera"; }
	
	vlcs[newid] = {};
	
	vlcs[newid].events = new events.EventEmitter();

	if (wcpSettings) {
		opts[newid] = wcpSettings;
		vlcs[newid].multiscreen = (typeof wcpSettings["multiscreen"] === "undefined") ? false : wcpSettings["multiscreen"];
	} else {
		opts[newid] = {};
		vlcs[newid].multiscreen = false;
	}
	if (typeof opts[newid].titleBar === 'undefined') opts[newid].titleBar = "fullscreen";
	opts[newid].uiHidden = false;
	opts[newid].subDelay = 0;
	opts[newid].lastItem = -1;
	opts[newid].aspectRatio = "Default";
	opts[newid].crop = "Default";
	opts[newid].zoom = 1;
	if (typeof opts[newid].allowFullscreen === 'undefined') opts[newid].allowFullscreen = true;

	playerbody = '<div' + targetid + ' style="height: 100%"><div class="wcp-center" style="overflow: hidden"><canvas class="wcp-canvas wcp-center"></canvas></div><div class="wcp-surface"></div><div class="wcp-menu wcp-playlist wcp-center"><div class="wcp-menu-close"></div><div class="wcp-menu-title">Playlist Menu</div><ul class="wcp-menu-items wcp-playlist-items"></ul></div><div class="wcp-menu wcp-subtitles wcp-center"><div class="wcp-menu-close"></div><div class="wcp-menu-title">Subtitle Menu</div><ul class="wcp-menu-items wcp-subtitles-items"></ul></div><div class="wcp-pause-anim wcp-center"><i class="wcp-anim-basic wcp-anim-icon-play"></i></div><div class="wcp-titlebar"><span class="wcp-title"></span></div><div class="wcp-toolbar"><div></div><div class="wcp-progress-bar"><div class="wcp-progress-seen"></div><div class="wcp-progress-pointer"></div></div><div class="wcp-button wcp-left wcp-prev" style="display: none"></div><div class="wcp-button wcp-left wcp-pause"></div><div class="wcp-button wcp-left wcp-next" style="display: none"></div><div class="wcp-button wcp-left wcp-vol-button wcp-volume-medium"></div><div class="wcp-vol-control"><div class="wcp-vol-bar"><div class="wcp-vol-bar-full"></div><div class="wcp-vol-bar-pointer"></div></div></div><div class="wcp-time"><span class="wcp-time-current"></span><span class="wcp-time-total"></span></div><div class="wcp-button wcp-right wcp-maximize"';
	if (!opts[newid].allowFullscreen) playerbody += ' style="cursor: not-allowed; color: rgba(123,123,123,0.6);"';
	playerbody += '></div><div class="wcp-button wcp-right wcp-playlist-but"></div><div class="wcp-button wcp-right wcp-subtitle-but"></div></div><div class="wcp-status"></div><div class="wcp-notif"></div><div class="wcp-subtitle-text"></div><div class="wcp-tooltip"><div class="wcp-tooltip-arrow"></div><div class="wcp-tooltip-inner">00:00</div></div></div>';
	
	opts[newid].currentSub = 0;
	opts[newid].trackSub = -1;
	
	$(this.context).each(function(ij,el) { if (!hasClass(el,"webchimeras")) $(el).addClass("webchimeras"); el.innerHTML = playerbody; });
	
	if (vlcs[newid].multiscreen) {
		vlcs[newid].multiscreen = (typeof wcpSettings["multiscreen"] === "undefined") ? false : wcpSettings["multiscreen"];
		$(newid).find(".wcp-toolbar").hide(0);
		$(newid).find(".wcp-tooltip").hide(0);
		wjs(newid).wrapper.css({cursor: 'pointer'});
	}

	wjs(newid).canvas = $(newid)[0].firstChild.firstChild;

	// resize video when window is resized
	if (firstTime) {
		firstTime = false;
		window.onresize = function() { autoResize(); };
		$(window).bind("mouseup",function(i) {
			return function(event) {
				mouseClickEnd(wjs(i),event);
			}
		}(newid)).bind("mousemove",function(i) {
			return function(event) {
				mouseMoved(wjs(i),event);
			}
		}(newid));
	}

	wjs(newid).wrapper.find(".wcp-menu-close").click(function() {
		if ($(this).parents(".wcp-wrapper").find(".wcp-playlist").is(":visible")) {
			$(".wcp-playlist-items").sortable("destroy");
			$(this).parents(".wcp-wrapper").find(".wcp-playlist").hide(0);
		} else if ($(this).parents(".wcp-wrapper").find(".wcp-subtitles").is(":visible")) {
			$(this).parents(".wcp-wrapper").find(".wcp-subtitles").hide(0);
		}
	});

	// toolbar button actions
	wjs(newid).wrapper.find(".wcp-button").click(function() {
		wjsPlayer = players["#"+$(this).parents(".wcp-wrapper")[0].id];
		vlc = wjsPlayer.vlc;
		buttonClass = this.className.replace("wcp-button","").replace("wcp-left","").replace("wcp-vol-button","").replace("wcp-right","").split(" ").join("");
		if (buttonClass == "wcp-playlist-but") {
			if ($(this).parents(".wcp-wrapper").find(".wcp-playlist").is(":visible")) wcp_hidePlaylist(wjsPlayer);
			else wcp_showPlaylist(wjsPlayer);
		}
		if (buttonClass == "wcp-subtitle-but") {
			if ($(this).parents(".wcp-wrapper").find(".wcp-subtitles").is(":visible")) wcp_hideSubtitles(wjsPlayer);
			else wcp_showSubtitles(wjsPlayer);
		}
		if ([3,4,6].indexOf(vlc.state) > -1) {
			if (buttonClass == "wcp-play") wjsPlayer.play().animatePause();
			else if (buttonClass == "wcp-pause") wjsPlayer.pause().animatePause();
			else if (buttonClass == "wcp-replay") {
				vlc.stop();
				wjsPlayer.play().animatePause();
			} else if (buttonClass == "wcp-prev") {
				if (vlc.playlist.currentItem > 0) {
					wjsPlayer.prev();
				}
			} else if (buttonClass == "wcp-next") {
				if (vlc.playlist.currentItem +1 < vlc.playlist.itemCount) {
					wjsPlayer.next();
				}
			} else if (["wcp-volume-low","wcp-volume-medium","wcp-volume-high","wcp-mute"].indexOf(buttonClass) > -1) {
				wjsPlayer.toggleMute();
			}
		}
		if ([5].indexOf(vlc.state) > -1 && buttonClass == "wcp-play") if (vlc.playlist.itemCount > 0) wjsPlayer.play().animatePause();
		if (buttonClass == "wcp-minimize") wcp_fullscreen_off(wjsPlayer);
		else if (buttonClass == "wcp-maximize") wcp_fullscreen_on(wjsPlayer);
	});
	
	// surface click actions
	wjs(newid).wrapper.find(".wcp-surface").click(function() {
		wjsPlayer = players["#"+$(this).parent()[0].id];
		vlc = wjsPlayer.vlc;
		if (vlc.state == 6) {
			$(this).parent().find(".wcp-replay").trigger("click");
			return;
		}
		if ([3,4].indexOf(vlc.state) > -1) {
			if (vlcs["#"+$(this).parents(".wcp-wrapper")[0].id].multiscreen && window.document.webkitFullscreenElement == null) {
				wcpWrapper = $(this).parents(".wcp-wrapper")[0];
				wjsPlayer.fullscreen(true);
				$(wcpWrapper).css({cursor: 'default'});
				if (wjsPlayer.vlc.mute) wjsPlayer.mute(false);
			} else {
				wjsPlayer.togglePause().animatePause();
			}
		}
		if ([5].indexOf(vlc.state) > -1 && !vlc.playing && vlc.playlist.itemCount > 0) wjsPlayer.play().animatePause();
	});
	
	wjs(newid).wrapper.find(".wcp-surface").dblclick(function() {
		wjsPlayer = players["#"+$(this).parents(".wcp-wrapper")[0].id];
		if (opts[wjsPlayer.context].allowFullscreen) {
			$(this).parents(".wcp-wrapper").find(".wcp-anim-basic").finish();
			$(this).parents(".wcp-wrapper").find(".wcp-pause-anim").finish();
			wcp_toggleFullscreen(wjsPlayer);
		}
	});
	
	wjs(newid).wrapper.parent().bind("mousemove",function(e) {
		if (opts["#"+$(this).find(".wcp-wrapper")[0].id].uiHidden === false) {
			if (vlcs["#"+$(this).find(".wcp-wrapper")[0].id].multiscreen && window.document.webkitFullscreenElement == null) {
				$(this).find(".wcp-wrapper").css({cursor: 'pointer'});
			} else {
				clearTimeout(vlcs["#"+$(this).find(".wcp-wrapper")[0].id].hideUI);
				$(this).find(".wcp-wrapper").css({cursor: 'default'});
				
				if (window.document.webkitFullscreenElement == null) {
					if (opts["#"+$(this).find(".wcp-wrapper")[0].id].titleBar == "both" || opts["#"+$(this).find(".wcp-wrapper")[0].id].titleBar == "minimized") {
						$(this).find(".wcp-titlebar").stop().show(0);
						if ($(this).find(".wcp-status").css("top") == "10px") $(this).find(".wcp-status").css("top", "35px");
						if ($(this).find(".wcp-notif").css("top") == "10px") $(this).find(".wcp-notif").css("top", "35px");
					}
				} else {
					if (opts["#"+$(this).find(".wcp-wrapper")[0].id].titleBar == "both" || opts["#"+$(this).find(".wcp-wrapper")[0].id].titleBar == "fullscreen") {
						$(this).find(".wcp-titlebar").stop().show(0);
						if ($(this).find(".wcp-status").css("top") == "10px") $(this).find(".wcp-status").css("top", "35px");
						if ($(this).find(".wcp-notif").css("top") == "10px") $(this).find(".wcp-notif").css("top", "35px");
					}
				}
	
				$(this).find(".wcp-toolbar").stop().show(0);
				if (!volDrag && !seekDrag) {
					if ($($(this).find(".wcp-toolbar").selector + ":hover").length > 0) {
						vlcs["#"+$(this).find(".wcp-wrapper")[0].id].hideUI = setTimeout(function(i) { return function() { wcp_hideUI($(i).parent()); } }($(this)),3000);
						vlcs["#"+$(this).find(".wcp-wrapper")[0].id].timestampUI = Math.floor(Date.now() / 1000);
					} else vlcs["#"+$(this).find(".wcp-wrapper")[0].id].hideUI = setTimeout(function(i) { return function() { wcp_hideUI(i); } }($(this)),3000);
				}
			}
		}
	});
	
    /* Progress and Volume Bars */
	wjs(newid).wrapper.find(".wcp-progress-bar").hover(function(arg1) {
		return progressHoverIn.call(this,arg1);
	}, function(e) {
		if (!seekDrag) sel.call(this,".wcp-tooltip").hide(0);
	});
	wjs(newid).wrapper.find(".wcp-progress-bar").bind("mousemove",function(arg1) {
		return progressMouseMoved.call(this,arg1);
	});

    wjs(newid).wrapper.find(".wcp-progress-bar").bind("mousedown", function(e) {
		seekDrag = true;
		var rect = $(this).parents(".wcp-wrapper")[0].getBoundingClientRect();
		p = (e.pageX - rect.left) / $(this).width();
		sel.call(this,".wcp-progress-seen").css("width", (p*100)+"%");
	});

    wjs(newid).wrapper.find(".wcp-vol-bar").bind("mousedown", function(e) {
		volDrag = true;
		var rect = sel.call(this,".wcp-vol-bar")[0].getBoundingClientRect();
		p = (e.pageX - rect.left) / $(this).width();
		players["#"+$(this).parents(".wcp-wrapper")[0].id].volume(Math.floor(p*200)+5);
	});

	wjs(newid).wrapper.find(".wcp-vol-button").hover(function() {
		$(sel.call(this,".wcp-vol-control")).animate({ width: 133 },200);
	},function() {
		if (!$($(sel.call(this,".wcp-vol-control")).selector + ":hover").length > 0 && !volDrag) {
			$(sel.call(this,".wcp-vol-control")).animate({ width: 0 },200);
		}
	});
	
	wjs(newid).wrapper.find('.wcp-vol-control').mouseout(function() {
		if (!$(sel.call(this,".wcp-vol-button").selector + ":hover").length > 0 && !$(sel.call(this,".wcp-vol-bar").selector + ":hover").length > 0 && !$(sel.call(this,".wcp-vol-control").selector + ":hover").length > 0 && !volDrag) {
			sel.call(this,".wcp-vol-control").animate({ width: 0 },200);
		}
	});
	
	// set initial status message font size
	var fontSize = (parseInt($(this.allElements[0]).height())/15);
	if (fontSize < 20) fontSize = 20;
	$(this.allElements[0]).find(".wcp-status").css('fontSize', fontSize);
	$(this.allElements[0]).find(".wcp-notif").css('fontSize', fontSize);
	$(this.allElements[0]).find(".wcp-subtitle-text").css('fontSize', fontSize);

	// create player and attach event handlers
	wjsPlayer = wjs(newid);
	vlcs[newid].hideUI = setTimeout(function(i) { return function() { wcp_hideUI($(i).parent()); } }(newid),6000);
	vlcs[newid].timestampUI = 0;
	vlcs[newid].renderer = require("wcjs-renderer");
	
	// set default network-caching to 10 seconds
	if (!wcpSettings["buffer"]) wcpSettings["buffer"] = 10000;
	
	if (!wcpSettings["vlcArgs"]) wcpSettings["vlcArgs"] = ["--network-caching="+wcpSettings["buffer"]];
	else {
		var checkBuffer = wcpSettings["vlcArgs"].some(function(el,ij) {
			if (el.indexOf("--network-caching") == 0) return true;
		});
		if (!checkBuffer) wcpSettings["vlcArgs"].push("--network-caching="+wcpSettings["buffer"]);
	}

	if (wcpSettings && wcpSettings["vlcArgs"]) vlcs[newid].vlc = vlcs[newid].renderer.init(wjs(newid).canvas,wcpSettings["vlcArgs"]);
	else vlcs[newid].vlc = vlcs[newid].renderer.init(wjs(newid).canvas);
	
	vlcs[newid].vlc.events.on("FrameSetup",function(i) {
		return function(width, height, pixelFormat, videoFrame) {
			vlcs[i.context].events.emit('FrameSetup', width, height, pixelFormat, videoFrame);
			singleResize(i, width, height, pixelFormat, videoFrame);
		}
	}(wjs(newid)));

	vlcs[newid].vlc.onPositionChanged = function(i) {
		return function(event) {
			positionChanged(wjs(i),event);
		}
	}(newid);

	vlcs[newid].vlc.onTimeChanged = function(i) {
		return function(event) {
			timePassed(wjs(i),event);
		}
	}(newid);

	vlcs[newid].vlc.onMediaChanged = function(i) {
		return function() {
			isMediaChanged(wjs(i));
		}
	}(newid);
	
	vlcs[newid].vlc.onNothingSpecial = function(i) {
		return function() {
			if (vlcs[wjs(i).context].lastState != "idle") {
				vlcs[wjs(i).context].lastState = "idle";
				vlcs[wjs(i).context].events.emit('StateChanged','idle');
				vlcs[wjs(i).context].events.emit('StateChangedInt',0);
			}
		}
	}(newid);
	
	vlcs[newid].vlc.onOpening = function(i) {
		return function() {
			if (vlcs[wjs(i).context].lastState != "opening") {
				vlcs[wjs(i).context].lastState = "opening";
				vlcs[wjs(i).context].events.emit('StateChanged','opening');
				vlcs[wjs(i).context].events.emit('StateChangedInt',1);
			}
			isOpening(wjs(i));
		}
	}(newid);

	vlcs[newid].vlc.onBuffering = function(i) {
		return function(event) {
			if (vlcs[wjs(i).context].lastState != "buffering") {
				vlcs[wjs(i).context].lastState = "buffering";
				vlcs[wjs(i).context].events.emit('StateChanged','buffering');
				vlcs[wjs(i).context].events.emit('StateChangedInt',2);
			}
			isBuffering(wjs(i),event);
		}
	}(newid);

	vlcs[newid].vlc.onPlaying = function(i) {
		return function() {
			if (vlcs[wjs(i).context].lastState != "playing") {
				vlcs[wjs(i).context].lastState = "playing";
				vlcs[wjs(i).context].events.emit('StateChanged','playing');
				vlcs[wjs(i).context].events.emit('StateChangedInt',3);
			}
			isPlaying(wjs(i));
			
			preventSleep();
		}
	}(newid);
	
	vlcs[newid].vlc.onLengthChanged = function(i) {
		return function(length) {
			if (length > 0) {
				if ($(wjs(i).context).find(".wcp-time-current").text() == "") $(wjs(i).context).find(".wcp-time-current").text("00:00");
				$(wjs(i).context).find(".wcp-time-total").text(" / "+parseTime(length));
			} else $(wjs(i).context).find(".wcp-time-total").text("");
		}
	}(newid);

	vlcs[newid].vlc.onPaused = function(i) {
		return function() {
			if (vlcs[wjs(i).context].lastState != "paused") {
				vlcs[wjs(i).context].lastState = "paused";
				vlcs[wjs(i).context].events.emit('StateChanged','paused');
				vlcs[wjs(i).context].events.emit('StateChangedInt',4);
				
				allowSleep();
			}
		}
	}(newid);
	
	vlcs[newid].vlc.onStopped = function(i) {
		return function() {
			if (vlcs[wjs(i).context].lastState != "stopping") {
				vlcs[wjs(i).context].lastState = "stopping";
				vlcs[wjs(i).context].events.emit('StateChanged','stopping');
				vlcs[wjs(i).context].events.emit('StateChangedInt',5);
			}
			opts[wjs(i).context].keepHidden = true;
			players[wjs(i).context].zoom(0);

			allowSleep();
		}
	}(newid);
	
	vlcs[newid].vlc.onEndReached = function(i) {
		return function() {
			if (vlcs[wjs(i).context].lastState != "ended") {
				vlcs[wjs(i).context].lastState = "ended";
				vlcs[wjs(i).context].events.emit('StateChanged','ended');
				vlcs[wjs(i).context].events.emit('StateChangedInt',6);
			}
			hasEnded(wjs(i));
			
			allowSleep();
		}
	}(newid);
	
	vlcs[newid].vlc.onEncounteredError = function(i) {
		return function() {
			if (vlcs[wjs(i).context].lastState != "error") {
				vlcs[wjs(i).context].lastState = "error";
				vlcs[wjs(i).context].events.emit('StateChanged','error');
				vlcs[wjs(i).context].events.emit('StateChangedInt',7);
			}
			
			allowSleep();
		}
	}(newid);
	
	// set playlist mode to single playback, the player has it's own playlist mode feature
	vlcs[newid].vlc.playlist.mode = vlcs[newid].vlc.playlist.Single;
	
	players[newid] = new wjs(newid);

	return players[newid];
};

// function to add playlist items
wjs.prototype.addPlaylist = function(playlist) {
	 if (this.itemCount() > 0) {
		 this.wrapper.find(".wcp-prev").show(0);
		 this.wrapper.find(".wcp-next").show(0);
	 }
	 // convert all strings to json object
	 if (Array.isArray(playlist) === true) {
		 var item = 0;
		 for (item = 0; typeof playlist[item] !== 'undefined'; item++) {
			 if (typeof playlist[item] === 'string') {
				 var tempPlaylist = playlist[item];
				 delete playlist[item];
				 playlist[item] = {
					url: tempPlaylist
				 };
			 }
		 }
	 } else if (typeof playlist === 'string') {		 
		 var tempPlaylist = playlist;
		 delete playlist;
		 playlist = [];
		 playlist.push({
			url: tempPlaylist
		 });
		 delete tempPlaylist;
	 } else if (typeof playlist === 'object') {
		 var tempPlaylist = playlist;
		 delete playlist;
		 playlist = [];
		 playlist.push(tempPlaylist);
		 delete tempPlaylist;
	 }
	 // end convert all strings to json object

	 if (Array.isArray(playlist) === true && typeof playlist[0] === 'object') {
		 var item = 0;
		 for (item = 0; item < playlist.length; item++) {
			  if (playlist[item].vlcArgs) {
				  if (!Array.isArray(playlist[item].vlcArgs)) {
					  if (playlist[item].vlcArgs.indexOf(" ") > -1) {
						  playlist[item].vlcArgs = playlist[item].vlcArgs.split(" ");
					  } else playlist[item].vlcArgs = [playlist[item].vlcArgs];
				  }
				  this.vlc.playlist.addWithOptions(playlist[item].url,playlist[item].vlcArgs);
			  } else this.vlc.playlist.add(playlist[item].url);
			  if (playlist[item].title) this.vlc.playlist.items[this.vlc.playlist.itemCount-1].title = "[custom]"+playlist[item].title;
			  this.vlc.playlist.items[this.vlc.playlist.itemCount-1].setting = "{}";
			  var playerSettings = {};
			  if (typeof playlist[item].aspectRatio !== 'undefined') {
				  if (item == 0) opts[this.context].aspectRatio = playlist[item].aspectRatio;
				  playerSettings.aspectRatio = playlist[item].aspectRatio;
			  }
			  if (typeof playlist[item].crop !== 'undefined') {
				  if (item == 0) opts[this.context].crop = playlist[item].crop;
				  playerSettings.crop = playlist[item].crop;
			  }
			  if (typeof playlist[item].zoom !== 'undefined') {
				  if (item == 0) opts[this.context].zoom = playlist[item].zoom;
				  playerSettings.zoom = playlist[item].zoom;
			  }
			  if (typeof playlist[item].subtitles !== 'undefined') playerSettings.subtitles = playlist[item].subtitles;
			  if (Object.keys(playerSettings).length > 0) this.vlc.playlist.items[this.vlc.playlist.itemCount-1].setting = JSON.stringify(playerSettings);
		  }
	 }
	 if (this.state() == "idle") {
		if (opts[this.context].autoplay || opts[this.context].autostart) {
			this.vlc.playlist.playItem(0);
		}
		if ((opts[this.context].mute || opts[this.context].multiscreen) && this.vlc.mute === false) {
			players[this.context].mute(true);
		}
	 }
	
	if (this.wrapper.find(".wcp-playlist").is(":visible")) printPlaylist(this);
	
	// show playlist button if multiple playlist items
	if (this.vlc.playlist.itemCount > 1) {
		this.wrapper.find(".wcp-playlist-but").css({ display: "block" });
	}

	return this;
};
// end function to add playlist items

// function to Get Subtitle Description
wjs.prototype.subDesc = function(getDesc) {
	// check if it is a number then return description
	if (!isNaN(getDesc)) {
		if (getDesc < this.vlc.subtitles.count) {
			wjs_subResponse = {};
			wjs_subResponse.language = this.vlc.subtitles[getDesc];
			wjs_subResponse.type = "internal";
			return wjs_subResponse;
		} else {
			var getSettings = {};
			getSettings = JSON.parse(this.vlc.playlist.items[this.vlc.playlist.currentItem].setting);
			if (getSettings.subtitles) {
				wjs_target = getSettings.subtitles;
				wjs_keepIndex = this.vlc.subtitles.count;
				if (wjs_keepIndex == 0) wjs_keepIndex = 1;
				for (var newDesc in wjs_target) if (wjs_target.hasOwnProperty(newDesc)) {
					if (getDesc == wjs_keepIndex) {
						wjs_subResponse = {};
						wjs_subResponse.language = newDesc;
						wjs_subResponse.type = "external";
						wjs_subResponse.url = wjs_target[newDesc];
						wjs_subResponse.ext = wjs_target[newDesc].split('.').pop().toLowerCase();
						if (wjs_subResponse.ext.indexOf('[') > -1) wjs_subResponse.ext = wjs_subResponse.ext.substr(0,wjs_subResponse.ext.indexOf('['));
						return wjs_subResponse;
					}
					wjs_keepIndex++;
				}
				return;
			}
		}
		return;
	} else return console.error("Value sent to .subDesc() needs to be a number.");
};
// end function to Get Subtitle Description

// function to Get Subtitle Count
wjs.prototype.subCount = function() {
	wjs_keepIndex = this.vlc.subtitles.count;
	var getSettings = {};
	getSettings = JSON.parse(this.vlc.playlist.items[this.vlc.playlist.currentItem].setting);
	if (getSettings.subtitles) {
		wjs_target = getSettings.subtitles;
		if (wjs_keepIndex == 0) wjs_keepIndex = 1;
		for (var newDesc in wjs_target) if (wjs_target.hasOwnProperty(newDesc)) wjs_keepIndex++;
		return wjs_keepIndex;
	}
	return wjs_keepIndex;
};
// end function to Get Subtitle Count

// function to Get/Set Subtitle Track
wjs.prototype.subTrack = function(newTrack) {
	if (typeof newTrack === 'number') {
		if (newTrack == 0) {
			this.vlc.subtitles.track = 0;
			clearSubtitles(this);
		} else {
			if (newTrack < this.vlc.subtitles.count) {
				$(this.allElements[0]).find(".wcp-subtitle-text").html("");
				opts[this.context].subtitles = [];
				this.vlc.subtitles.track = newTrack;
			} else {
				$(this.allElements[0]).find(".wcp-subtitle-text").html("");
				opts[this.context].subtitles = [];
				
				if (this.vlc.subtitles.track > 0) this.vlc.subtitles.track = 0;
				
				if (this.vlc.subtitles.count > 0) newSub = newTrack - this.vlc.subtitles.count +1;
				else newSub = newTrack - this.vlc.subtitles.count;
				
				itemSetting = JSON.parse(this.vlc.playlist.items[this.vlc.playlist.currentItem].setting);
				target = itemSetting.subtitles;
				for (var k in target) if (target.hasOwnProperty(k)) {
					newSub--;
					if (newSub == 0) {
						loadSubtitle(this,target[k]);
						break;
					}
				}
			}
			opts[this.context].currentSub = newTrack;
			printSubtitles(this);
		}
	} else {
		return opts[this.context].currentSub;
	}
	return this;
};
// end function to Get/Set Subtitle Track

wjs.prototype.subDelay = function(newDelay) {
	if (typeof newDelay === 'number') {
		this.vlc.subtitles.delay = newDelay;
		opts[this.context].subDelay = newDelay;
	} else return opts[this.context].subDelay;
	return this;
}

wjs.prototype.audioCount = function() {
	return parseInt(this.vlc.audio.count);
}
wjs.prototype.audioTrack = function(newTrack) {
	if (typeof newTrack === 'number') this.vlc.audio.track = newTrack;
	else return this.vlc.audio.track;
	return this;
}
wjs.prototype.audioDesc = function(getDesc) {
	if (typeof getDesc === 'number') return this.vlc.audio[getDesc];
	return this;
}
wjs.prototype.audioDelay = function(newDelay) {
	if (typeof newDelay === 'number') this.vlc.audio.delay = newDelay;
	else return this.vlc.audio.delay;
	return this;
}
wjs.prototype.audioChan = function(newChan) {
	if (typeof newChan === 'string') {
		if (newChan == "error") this.vlc.audio.channel = -1;
		else if (newChan == "stereo") this.vlc.audio.channel = 1;
		else if (newChan == "reverseStereo") this.vlc.audio.channel = 2;
		else if (newChan == "left") this.vlc.audio.channel = 3;
		else if (newChan == "right") this.vlc.audio.channel = 4;
		else if (newChan == "dolby") this.vlc.audio.channel = 5;
		else return false;
	} else {
		if (this.vlc.audio.channel == -1) return "error";
		else if (this.vlc.audio.channel == 1) return "stereo";
		else if (this.vlc.audio.channel == 2) return "reverseStereo";
		else if (this.vlc.audio.channel == 3) return "left";
		else if (this.vlc.audio.channel == 4) return "right";
		else if (this.vlc.audio.channel == 5) return "dolby";
	}
	return this;
}

wjs.prototype.audioChanInt = function(newChan) {
	if (typeof newChan === 'number') this.vlc.audio.channel = newChan;
	else return this.vlc.audio.channel;
	return this;
}

wjs.prototype.deinterlace = function(newMode) {
	if (typeof newMode === 'string') {
		if (newMode == 'disabled') this.vlc.video.deinterlace.disable();
		else this.vlc.video.deinterlace.enable(newMode);
	} else return false;
	return this;
}

wjs.prototype.mute = function(newMute) {
	if (typeof newMute === "boolean") {
		if (this.vlc.mute !== newMute) {
			if (!this.vlc.mute) players[this.context].volume(0);
			else {
				if (opts[this.context].lastVolume <= 15) opts[this.context].lastVolume = 100;
				players[this.context].volume(opts[this.context].lastVolume);
			}
		} else return false;
	} else return this.vlc.mute;
};

wjs.prototype.volume = function(newVolume) {
	if (typeof newVolume !== 'undefined' && !isNaN(newVolume) && newVolume >= 0 && newVolume <= 5) {
		opts[this.context].lastVolume = this.vlc.volume;
		this.vlc.volume = 0;
		if (!this.vlc.mute) {
			this.wrapper.find(".wcp-vol-button").removeClass("wcp-volume-medium").removeClass("wcp-volume-high").removeClass("wcp-volume-low").addClass("wcp-mute");
			this.vlc.mute = true;
		}
		this.wrapper.find(".wcp-vol-bar-full").css("width", "0px");
	} else if (newVolume && !isNaN(newVolume) && newVolume > 5 && newVolume <= 200) {
		if (this.vlc.mute) this.vlc.mute = false;

		if (newVolume > 150) this.wrapper.find(".wcp-vol-button").removeClass("wcp-mute").removeClass("wcp-volume-medium").removeClass("wcp-volume-low").addClass("wcp-volume-high");
		else if (newVolume > 50) this.wrapper.find(".wcp-vol-button").removeClass("wcp-mute").removeClass("wcp-volume-high").removeClass("wcp-volume-low").addClass("wcp-volume-medium");
		else this.wrapper.find(".wcp-vol-button").removeClass("wcp-mute").removeClass("wcp-volume-medium").removeClass("wcp-volume-high").addClass("wcp-volume-low");

		this.wrapper.find(".wcp-vol-bar-full").css("width", (((newVolume/200)*parseInt(this.wrapper.find(".wcp-vol-bar").css("width")))-parseInt(this.wrapper.find(".wcp-vol-bar-pointer").css("width")))+"px");
		this.vlc.volume = parseInt(newVolume);
	} else return parseInt(this.vlc.volume);
	return this;
};

wjs.prototype.time = function(newTime) {
	if (typeof newTime === 'number') {
		this.vlc.time = newTime;
		this.wrapper.find(".wcp-time-current").text(parseTime(newTime,this.vlc.length));
		this.wrapper.find(".wcp-progress-seen")[0].style.width = (newTime/(this.vlc.length)*100)+"%";
	} else return parseInt(this.vlc.time);
	return this;
}

wjs.prototype.position = function(newPosition) {
	if (typeof newPosition === 'number') {
		this.vlc.position = newPosition;
		this.wrapper.find(".wcp-time-current").text(parseTime(this.vlc.length*newPosition,this.vlc.length));
		this.wrapper.find(".wcp-progress-seen")[0].style.width = (newPosition*100)+"%";
	} else return this.vlc.position;
	return this;
}

wjs.prototype.rate = function(newRate) {
	if (typeof newRate === 'number') this.vlc.input.rate = newRate;
	else return this.vlc.input.rate;
	return this;
}

wjs.prototype.currentItem = function(i) {
	if (typeof i !== 'undefined') {
		if (i != this.vlc.playlist.currentItem) {
			if (i < this.vlc.playlist.itemCount && i > -1) {
				if (wjsPlayer.vlc.playlist.items[i].disabled) {
					wjsPlayer.vlc.playlist.items[i].disabled = false;
					if (this.wrapper.find(".wcp-playlist").is(":visible")) {
						this.wrapper.find(".wcp-playlist-items:eq("+i+")").removeClass("wcp-disabled");
					}
					this.wrapper.find(".wcp-playlist").find(".wcp-menu-selected").removeClass("wcp-menu-selected");
					this.wrapper.find(".wcp-playlist-items:eq("+i+")").addClass("wcp-menu-selected");
				}
				opts[this.context].keepHidden = true;
				players[this.context].zoom(0);
				
				wjs_button = this.wrapper.find(".wcp-play");
				if (wjs_button.length != 0) wjs_button.removeClass("wcp-play").addClass("wcp-pause");
				
				wjs_button = this.wrapper.find(".wcp-replay");
				if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-pause");
		
				this.vlc.playlist.currentItem = i;
		
				positionChanged(this,0);
				this.wrapper.find(".wcp-time-current").text("");
				this.wrapper.find(".wcp-time-total").text("");
			}
		}
	} else return this.vlc.playlist.currentItem;
	return this;
}

wjs.prototype.itemCount = function() {
	return parseInt(this.vlc.playlist.itemCount);
}

wjs.prototype.itemDesc = function(getDesc) {
	if (typeof getDesc === 'number') {
		if (getDesc > -1 && getDesc < this.vlc.playlist.itemCount) {
			wjsDesc = JSON.stringify(this.vlc.playlist.items[getDesc]);
			return JSON.parse(wjsDesc.replace('"title":"[custom]','"title":"').split('\\"').join('"').split('"{').join('{').split('}"').join('}'));
		} else return false;
	}
	return false;
}

wjs.prototype.playing = function() {
	return this.vlc.playing;
}

wjs.prototype.length = function() {
	return this.vlc.length;
}

wjs.prototype.fps = function() {
	return this.vlc.input.fps;
}

wjs.prototype.state = function() {
	reqState = this.vlc.state;
	if (reqState == 0) return "idle";
	else if (reqState == 1) return "opening";
	else if (reqState == 2) return "buffering";
	else if (reqState == 3) return "playing";
	else if (reqState == 4) return "paused";
	else if (reqState == 5) return "stopping";
	else if (reqState == 6) return "ended";
	else if (reqState == 7) return "error";
	return false;
}

wjs.prototype.stateInt = function() {
	return this.vlc.state;
}

wjs.prototype.width = function() {
	return this.canvas.width;
}

wjs.prototype.height = function() {
	return this.canvas.height;
}

wjs.prototype.aspectRatio = function(newRatio) {
	if (typeof newRatio === 'string') {
		opts[this.context].aspectRatio = newRatio;
		autoResize();
	} else return opts[this.context].aspectRatio;
	return this;
}

wjs.prototype.crop = function(newCrop) {
	if (typeof newCrop === 'string') {
		opts[this.context].crop = newCrop;
		autoResize();
	} else return opts[this.context].crop;
	return this;
}

wjs.prototype.zoom = function(newZoom) {
	if (typeof newZoom === 'number') {
		opts[this.context].zoom = newZoom;
		autoResize();
	} else return opts[this.context].zoom;
	return this;
}

wjs.prototype.advanceItem = function(newX,newY) {
	if (typeof newX === 'number' && typeof newY === 'number') {
		this.vlc.playlist.advanceItem(newX,newY);
		if (this.wrapper.find(".wcp-playlist").is(":visible")) printPlaylist(this);
	} else return false;
	return this;
}

wjs.prototype.removeItem = function(remItem) {
	if (typeof remItem === 'number') {
		 if (this.itemCount() <= 2) {
			 if (this.vlc.playlist.removeItem(remItem)) {
				 this.wrapper.find(".wcp-prev").hide(0);
				 this.wrapper.find(".wcp-next").hide(0);
			 }
		 } else this.vlc.playlist.removeItem(remItem);
		if (this.wrapper.find(".wcp-playlist").is(":visible")) printPlaylist(this);
		// hide playlist button if less then 2 playlist items
		if (this.vlc.playlist.itemCount < 2) {
			this.wrapper.find(".wcp-playlist-but").css({ display: "none" });
		}
	} else return false;
	return this;
}

wjs.prototype.clearPlaylist = function() {
	this.stop();
	this.vlc.playlist.clear();
	this.wrapper.find(".wcp-time-total").text("");
	if (this.wrapper.find(".wcp-playlist").is(":visible")) printPlaylist(this);
	if (this.wrapper.find(".wcp-playlist-but").is(":visible")) {
		this.wrapper.find(".wcp-playlist-but").hide(0);
	}
	return this;
}

function progressHoverIn(e) {
	wjsPlayer = wjs("#"+$(this).parents(".wcp-wrapper")[0].id);
	vlc = wjsPlayer.vlc;
	if (vlc.length) {
		var rect = wjsPlayer.wrapper[0].getBoundingClientRect();
		if (e.pageX >= rect.left && e.pageX <= rect.right) {
			var newtime = Math.floor(vlc.length * ((e.pageX - rect.left) / $(this).width()));
			if (newtime > 0) {
				wjsPlayer.wrapper.find(".wcp-tooltip-inner").text(parseTime(newtime));
				var offset = Math.floor(wjsPlayer.wrapper.find(".wcp-tooltip").width() / 2);
				if (e.pageX >= (offset + rect.left) && e.pageX <= (rect.right - offset)) {
					wjsPlayer.wrapper.find(".wcp-tooltip").css("left",((e.pageX - rect.left) - offset)+"px");
				} else if (e.pageX < (rect.left + offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",rect.left+"px");
				else if (e.pageX > (rect.right - offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",(rect.right - wjsPlayer.wrapper.find(".wcp-tooltip").width())+"px");
				wjsPlayer.wrapper.find(".wcp-tooltip").show(0);
			}
		} else wjsPlayer.wrapper.find(".wcp-tooltip").hide(0);
	}
}

function progressMouseMoved(e) {
	wjsPlayer = wjs("#"+$(this).parents(".wcp-wrapper")[0].id);
	vlc = wjsPlayer.vlc;
	if (vlc.length) {
		var rect = wjsPlayer.wrapper[0].getBoundingClientRect();
		if (e.pageX >= rect.left && e.pageX <= rect.right) {
			var newtime = Math.floor(vlc.length * ((e.pageX - rect.left) / $(this).width()));
			if (newtime > 0) {
				wjsPlayer.wrapper.find(".wcp-tooltip-inner").text(parseTime(newtime));
				var offset = Math.floor(wjsPlayer.wrapper.find(".wcp-tooltip").width() / 2);
				if (e.pageX >= (offset + rect.left) && e.pageX <= (rect.right - offset)) {
					wjsPlayer.wrapper.find(".wcp-tooltip").css("left",((e.pageX - rect.left) - offset)+"px");
				} else if (e.pageX < (rect.left + offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",rect.left+"px");
				else if (e.pageX > (rect.right - offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",(rect.right - wjsPlayer.wrapper.find(".wcp-tooltip").width())+"px");
				wjsPlayer.wrapper.find(".wcp-tooltip").show(0);
			}
		} else wjsPlayer.wrapper.find(".wcp-tooltip").hide(0);
	}
}

function mouseClickEnd(wjsPlayer,e) {
	clearInterval(vlcs["#"+wjsPlayer.wrapper[0].id].hideUI);
	$(wjsPlayer.canvas).parent().parent().parent().css({cursor: 'default'});
	vlcs["#"+wjsPlayer.wrapper[0].id].hideUI = setTimeout(function(i) { return function() { wcp_hideUI($(i).parent()); } }(wjsPlayer.context),3000);
	if (seekDrag) {
		seekDrag = false;
		if (window.document.webkitFullscreenElement != null) {
			vlc = wjs("#"+window.document.webkitFullscreenElement.id).vlc;
			p = e.pageX / window.document.webkitFullscreenElement.offsetWidth;
			$(window.document.webkitFullscreenElement).find(".wcp-progress-seen").css("width", (p*100)+"%");
			vlc.position = p;
			$(window.document.webkitFullscreenElement).find(".wcp-tooltip").hide(0);
			$(window.document.webkitFullscreenElement).find(".wcp-time-current").text($(window.document.webkitFullscreenElement).find(".wcp-tooltip-inner").text());
		} else {
			if ($(".webchimeras").length == 1) {
				$(".wcp-tooltip").fadeOut();
				var rect = $(".wcp-wrapper")[0].getBoundingClientRect();
				if (e.pageX >= rect.left && e.pageX <= rect.right) {
					vlc = wjs("#"+$(".wcp-wrapper")[0].id).vlc;
					p = (e.pageX - rect.left) / (rect.right - rect.left);
					$(".wcp-progress-seen").css("width", (p*100)+"%");
					vlc.position = p;
					$(wjs("#"+$(".wcp-wrapper")[0].id).canvas).parents(".wcp-wrapper").find(".wcp-time-current").text($(wjs("#"+$(".wcp-wrapper")[0].id).canvas).parents(".wcp-wrapper").find(".wcp-tooltip-inner").text());
				}
			} else {
				$('.webchimeras').each(function(i, obj) {
					var rect = obj.getBoundingClientRect();
					if (e.pageX >= rect.left && e.pageX <= rect.right && e.pageY >= rect.top && e.pageY <= rect.bottom) {
						vlc = wjs("#"+$(obj).find(".wcp-wrapper")[0].id).vlc;
						p = (e.pageX - rect.left) / (rect.right - rect.left);
						$(obj).find(".wcp-progress-seen").css("width", (p*100)+"%");
						vlc.position = p;
					}
					$(obj).find(".wcp-tooltip").hide(0);
					$(obj).find(".wcp-time-current").text($(obj).find(".wcp-tooltip-inner").text());
				});
			}
		}
	}
	if (volDrag) {
		volDrag = false;
		if (window.document.webkitFullscreenElement != null) {
			obj = window.document.webkitFullscreenElement;
			rect = $(obj).find(".wcp-vol-bar")[0].getBoundingClientRect();
			if (e.pageX >= rect.right) {
				p = 1;
				setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
			} else if (e.pageX <= rect.left)  {
				p = 0;
				setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
			} else {
				p = (e.pageX - rect.left) / (rect.right - rect.left);
				if (e.pageY < rect.top) setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
				else if (e.pageY > rect.bottom) setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
			}
			players["#"+obj.id].volume(Math.floor(200* p)+5);
		} else {
			if ($(".webchimeras").length == 1) {
				var rect = $(".wcp-vol-bar")[0].getBoundingClientRect();
				if (e.pageX >= rect.right) {
					p = 1;
					setTimeout(function() { $(".wcp-vol-control").animate({ width: 0 },200); },1500);
				} else if (e.pageX <= rect.left)  {
					p = 0;
					setTimeout(function() { $(".wcp-vol-control").animate({ width: 0 },200); },1500);
				} else {
					p = (e.pageX - rect.left) / (rect.right - rect.left);
					if (e.pageY < rect.top) setTimeout(function() { $(".wcp-vol-control").animate({ width: 0 },200); },1500);
					else if (e.pageY > rect.bottom) setTimeout(function() { $(".wcp-vol-control").animate({ width: 0 },200); },1500);
				}
				players["#"+$(".wcp-wrapper")[0].id].volume(Math.floor(200* p)+5);
			} else {
				$('.webchimeras').each(function(i, obj) {
					var rect = obj.getBoundingClientRect();
					if (e.pageX >= rect.left && e.pageX <= rect.right && e.pageY >= rect.top && e.pageY <= rect.bottom) {
						rect = $(obj).find(".wcp-vol-bar")[0].getBoundingClientRect();
						if (e.pageX >= rect.right) {
							p = 1;
							setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
						} else if (e.pageX <= rect.left)  {
							p = 0;
							setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
						} else {
							p = (e.pageX - rect.left) / (rect.right - rect.left);
							if (e.pageY < rect.top) setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
							else if (e.pageY > rect.bottom) setTimeout(function() { $(obj).find(".wcp-vol-control").animate({ width: 0 },200); },1500);
						}
						players["#"+$(obj).find(".wcp-wrapper")[0].id].volume(Math.floor(200* p)+5);
					}
				});
			}
		}
	}
}

function mouseMoved(wjsPlayer,e) {
	if (seekDrag) {
		if (window.document.webkitFullscreenElement != null) {
			p = e.pageX / window.document.webkitFullscreenElement.offsetWidth;
			wjsPlayer = wjs("#"+window.document.webkitFullscreenElement.id);
			wjsPlayer.wrapper.find(".wcp-progress-seen").css("width", (p*100)+"%");
			vlc = wjsPlayer.vlc;
			var newtime = Math.floor(vlc.length * (e.pageX / window.document.webkitFullscreenElement.offsetWidth));
			if (newtime > 0) {
				wjsPlayer.wrapper.find(".wcp-tooltip-inner").text(parseTime(newtime));
				var offset = Math.floor(wjsPlayer.wrapper.find(".wcp-tooltip").width() / 2);
				if (e.pageX >= (offset + 0) && e.pageX <= (window.document.webkitFullscreenElement.offsetWidth - offset)) {
					wjsPlayer.wrapper.find(".wcp-tooltip").css("left",(e.pageX - offset)+"px");
				} else if (e.pageX < (window.document.webkitFullscreenElement.offsetWidth + offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left","0px");
				else if (e.pageX > offset*(-1)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",(0 - wjsPlayer.wrapper.find(".wcp-tooltip").width())+"px");
				wjsPlayer.wrapper.find(".wcp-tooltip").show(0);
			}
			
		} else {
			if ($(".webchimeras").length == 1) {
				var rect = $(".wcp-wrapper")[0].getBoundingClientRect();
				if (e.pageX >= rect.left && e.pageX <= rect.right) {
					p = (e.pageX - rect.left) / (rect.right - rect.left);
					$(".wcp-progress-seen").css("width", (p*100)+"%");
				}
				vlc = wjsPlayer.vlc;
				var newtime = Math.floor(vlc.length * ((e.pageX - rect.left) / $(wjsPlayer.canvas).parent().parent().parent().width()));
				if (newtime > 0) {
					wjsPlayer.wrapper.find(".wcp-tooltip-inner").text(parseTime(newtime));
					var offset = Math.floor(wjsPlayer.wrapper.find(".wcp-tooltip").width() / 2);
					if (e.pageX >= (offset + rect.left) && e.pageX <= (rect.right - offset)) {
						wjsPlayer.wrapper.find(".wcp-tooltip").css("left",((e.pageX - rect.left) - offset)+"px");
					} else if (e.pageX < (rect.left + offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",rect.left+"px");
					else if (e.pageX > (rect.right - offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",(rect.right - wjsPlayer.wrapper.find(".wcp-tooltip").width())+"px");
					wjsPlayer.wrapper.find(".wcp-tooltip").show(0);
				}
			} else {
				var rect = wjsPlayer.wrapper[0].getBoundingClientRect();
				$('.webchimeras').each(function(i, obj) {
					var rect = obj.getBoundingClientRect();
					if (e.pageX >= rect.left && e.pageX <= rect.right && e.pageY >= rect.top && e.pageY <= rect.bottom) {
						p = (e.pageX - rect.left) / (rect.right - rect.left);
						wjsPlayer = wjs("#"+$(obj).find(".wcp-wrapper")[0].id);
						wjsPlayer.wrapper.find(".wcp-progress-seen").css("width", (p*100)+"%");
						vlc = wjsPlayer.vlc;
						var newtime = Math.floor(vlc.length * ((e.pageX - rect.left) / $(this).width()));
						if (newtime > 0) {
							wjsPlayer.wrapper.find(".wcp-tooltip-inner").text(parseTime(newtime));
							var offset = Math.floor(wjsPlayer.wrapper.find(".wcp-tooltip").width() / 2);
							if (e.pageX >= (offset + rect.left) && e.pageX <= (rect.right - offset)) {
								wjsPlayer.wrapper.find(".wcp-tooltip").css("left",((e.pageX - rect.left) - offset)+"px");
							} else if (e.pageX < (rect.left + offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",rect.left+"px");
							else if (e.pageX > (rect.right - offset)) wjsPlayer.wrapper.find(".wcp-tooltip").css("left",(rect.right - wjsPlayer.wrapper.find(".wcp-tooltip").width())+"px");
							wjsPlayer.wrapper.find(".wcp-tooltip").show(0);
						}
					}
				});
			}
		}
	}
	if (volDrag) {
		if (window.document.webkitFullscreenElement != null) {
			wjsPlayer = wjs("#"+window.document.webkitFullscreenElement.id);
			var rect = wjsPlayer.wrapper.find(".wcp-vol-bar")[0].getBoundingClientRect();
			if (e.pageX >= rect.left && e.pageX <= rect.right) {
				p = (e.pageX - rect.left) / (rect.right - rect.left);
				players[wjsPlayer.context].volume(Math.floor(200* p)+5);
			}
		} else {
			if ($(".webchimeras").length == 1) {
				var rect = $(".wcp-vol-bar")[0].getBoundingClientRect();
				if (e.pageX >= rect.left && e.pageX <= rect.right) {
					p = (e.pageX - rect.left) / (rect.right - rect.left);
					players["#"+$(".wcp-wrapper")[0].id].volume(Math.floor(200* p)+5);
				}
			} else {
				$('.webchimeras').each(function(i, obj) {
					wjsPlayer = wjs("#"+$(obj).find(".wcp-wrapper")[0].id);
					var rect = wjsPlayer.wrapper.find(".wcp-vol-bar")[0].getBoundingClientRect();
					var rectWrapper = $(wjsPlayer.canvas).parents(".webchimeras")[0].getBoundingClientRect();
					if (e.pageX >= rectWrapper.left && e.pageX <= rectWrapper.right && e.pageY >= rectWrapper.top && e.pageY <= rectWrapper.bottom) {
						if (e.pageX >= rect.left && e.pageX <= rect.right) {
							p = (e.pageX - rect.left) / (rect.right - rect.left);
							players[wjsPlayer.context].volume(Math.floor(200* p)+5);
						}
					}
				});
			}
		}
	}
}

// event proxies
wjs.prototype.onMediaChanged = function(wjs_function) { this.catchEvent("MediaChanged",wjs_function); return this; }
wjs.prototype.onIdle = function(wjs_function) { this.catchEvent("NothingSpecial",wjs_function); return this; }
wjs.prototype.onOpening = function(wjs_function) { this.catchEvent("Opening",wjs_function); return this; }
wjs.prototype.onBuffering = function(wjs_function) { this.catchEvent("Buffering",wjs_function); return this; }
wjs.prototype.onPlaying = function(wjs_function) { this.catchEvent("Playing",wjs_function); return this; }
wjs.prototype.onPaused = function(wjs_function) { this.catchEvent("Paused",wjs_function); return this; }
wjs.prototype.onForward = function(wjs_function) { this.catchEvent("Forward",wjs_function); return this; }
wjs.prototype.onBackward = function(wjs_function) { this.catchEvent("Backward",wjs_function); return this; }
wjs.prototype.onError = function(wjs_function) { this.catchEvent("EncounteredError",wjs_function); return this; }
wjs.prototype.onEnded = function(wjs_function) { this.catchEvent("EndReached",wjs_function); return this; }
wjs.prototype.onStopped = function(wjs_function) { this.catchEvent("Stopped",wjs_function); return this; }
wjs.prototype.onState = function(wjs_function) { vlcs[this.context].events.on('StateChanged',wjs_function); return this; }
wjs.prototype.onStateInt = function(wjs_function) { vlcs[this.context].events.on('StateChangedInt',wjs_function); return this; }
wjs.prototype.onTime = function(wjs_function) { this.catchEvent("TimeChanged",wjs_function); return this; }
wjs.prototype.onPosition = function(wjs_function) { this.catchEvent("PositionChanged",wjs_function); return this; }
wjs.prototype.onFrameSetup = function(wjs_function) { vlcs[this.context].events.on('FrameSetup',wjs_function); return this; }
// end event proxies

// catch event function
wjs.prototype.catchEvent = function(wjs_event,wjs_function) {
	var saveContext = wjs(this.context);
	this.vlc.events.on(wjs_event, function(event) { return wjs_function.call(saveContext,event); } );
	return this;
};
// end catch event function

wjs.prototype.video = function(newBool) {
	if (typeof newBool !== 'undefined') {
		if (newBool === true) {
			if (opts[this.context].zoom == 0) {
				opts[this.context].zoom = opts[this.context].lastZoom;
				delete opts[this.context].lastZoom;
				autoResize();
				return true;
			} else return false;
		} else {
			if (opts[this.context].zoom > 0) {
				opts[this.context].lastZoom = opts[this.context].zoom;
				opts[this.context].zoom = 0;
				autoResize();
				return true;
			} else return false;
		}
	}
};

wjs.prototype.playlist = function(newBool) {
	if (typeof newBool !== 'undefined') {
		if (newBool === true) return wcp_showPlaylist(this);
		else return wcp_hidePlaylist(this);
	} else return this.wrapper.find(".wcp-playlist")[0];
};

wjs.prototype.subtitles = function(newBool) {
	if (typeof newBool !== 'undefined') {
		if (newBool === true) return wcp_showSubtitles(this);
		else return wcp_hideSubtitles(this);
	} else return this.wrapper.find(".wcp-subtitles")[0];
};

wjs.prototype.ui = function(newBool) {
	if (typeof newBool !== 'undefined') {
		if (newBool === true) {
			if (opts[this.context].uiHidden) {
				opts[this.context].uiHidden = false;
				this.wrapper.find(".wcp-titlebar").stop().show(0);
				this.wrapper.find(".wcp-toolbar").stop().show(0);
				this.wrapper.css({cursor: 'default'});
				return true;
			} else return false;
		} else {
			if (!opts[this.context].uiHidden) {
				opts[this.context].uiHidden = true;
				this.wrapper.find(".wcp-titlebar").stop().hide(0);
				this.wrapper.find(".wcp-toolbar").stop().hide(0);
				this.wrapper.find(".wcp-tooltip").stop().hide(0);
				this.wrapper.css({cursor: 'default'});
				return true;
			} else return false;
		}
	} else return this;
};

wjs.prototype.notify = function(newMessage) {
	wjsPlayer = players[this.context];
	wjsPlayer.wrapper.find(".wcp-notif").text(newMessage);
	wjsPlayer.wrapper.find(".wcp-notif").stop().show(0);
	if (opts[this.context].notifTimer) clearTimeout(opts[this.context].notifTimer);
	opts[this.context].notifTimer = setTimeout(function() { wjsPlayer.wrapper.find(".wcp-notif").fadeOut(1500); },1000);
};

wjs.prototype.toggleFullscreen = function() {
	return wcp_toggleFullscreen(this);
}

wjs.prototype.fullscreen = function(newBool) {
	if (typeof newBool !== 'undefined') {
		if (newBool === true) return wcp_fullscreen_on(this);
		else return wcp_fullscreen_off(this);
	} else {
		if (window.document.webkitFullscreenElement == null) return false;
		else return true;
	}
};

wjs.prototype.animatePause = function() {
	$(this.context).find(".wcp-anim-basic").css("fontSize", "50px");
	$(this.context).find(".wcp-anim-basic").css("padding", "7px 27px");
	$(this.context).find(".wcp-anim-basic").css("borderRadius", "12px");
	$(this.context).find(".wcp-pause-anim").fadeIn(200).fadeOut(200);
	$(this.context).find(".wcp-anim-basic").animate({ fontSize: "80px", padding: "7px 30px" },400);
}

// html element selector
function sel(context) {
	return $($(this).parents(".wcp-wrapper")[0]).find(context);
}

function wcp_toggleFullscreen(wjsPlayer) {
	if (window.document.webkitFullscreenElement == null) return wcp_fullscreen_on(wjsPlayer);
	else return wcp_fullscreen_off(wjsPlayer);
}

function wcp_fullscreen_on(wjsPlayer) {
	if (window.document.webkitFullscreenElement == null) {
		if (opts[wjsPlayer.context].titleBar == "none" || opts[wjsPlayer.context].titleBar == "minimized") {
			wjsPlayer.wrapper.find(".wcp-titlebar").hide(0);
			if (wjsPlayer.wrapper.find(".wcp-status").css("top") == "35px") wjsPlayer.wrapper.find(".wcp-status").css("top", "10px");
			if (wjsPlayer.wrapper.find(".wcp-notif").css("top") == "35px") wjsPlayer.wrapper.find(".wcp-notif").css("top", "10px");
		} else {
			if (wjsPlayer.wrapper.find(".wcp-status").css("top") == "10px") wjsPlayer.wrapper.find(".wcp-status").css("top", "35px");
			if (wjsPlayer.wrapper.find(".wcp-notif").css("top") == "10px") wjsPlayer.wrapper.find(".wcp-notif").css("top", "35px");
		}
		wcpWrapper = wjsPlayer.wrapper[0];
		if (wcpWrapper.webkitRequestFullscreen) wcpWrapper.webkitRequestFullscreen();
		else if (wcpWrapper.requestFullscreen) wcpWrapper.requestFullscreen();
		
		if (wjsPlayer.wrapper.find(".wcp-maximize").length > 0) {
			switchClass(wjsPlayer.wrapper.find(".wcp-maximize")[0],"wcp-maximize","wcp-minimize");
		}
		return true;
	} else return false;
}

function wcp_fullscreen_off(wjsPlayer) {
	if (window.document.webkitFullscreenElement != null) {
		if (opts[wjsPlayer.context].titleBar == "none" || opts[wjsPlayer.context].titleBar == "fullscreen") {
			wjsPlayer.wrapper.find(".wcp-titlebar").hide(0);
			if (wjsPlayer.wrapper.find(".wcp-status").css("top") == "35px") wjsPlayer.wrapper.find(".wcp-status").css("top", "10px");
			if (wjsPlayer.wrapper.find(".wcp-notif").css("top") == "35px") wjsPlayer.wrapper.find(".wcp-notif").css("top", "10px");
		} else {
			if (wjsPlayer.wrapper.find(".wcp-status").css("top") == "10px") wjsPlayer.wrapper.find(".wcp-status").css("top", "35px");
			if (wjsPlayer.wrapper.find(".wcp-notif").css("top") == "10px") wjsPlayer.wrapper.find(".wcp-notif").css("top", "35px");
		}

		
		if (window.document.webkitCancelFullScreen) window.document.webkitCancelFullScreen();
		else if (window.document.cancelFullScreen) window.document.cancelFullScreen();

		if (wjsPlayer.wrapper.find(".wcp-minimize").length > 0) {
			switchClass(wjsPlayer.wrapper.find(".wcp-minimize")[0],"wcp-minimize","wcp-maximize");
		}
		if (vlcs[wjsPlayer.context].multiscreen) {
			wjsPlayer.wrapper.find(".wcp-titlebar").hide(0);
			wjsPlayer.wrapper.find(".wcp-toolbar").hide(0);
			wjsPlayer.wrapper.find(".wcp-tooltip").hide(0);
			wjsPlayer.wrapper.css({cursor: 'pointer'});
			if (!wjsPlayer.vlc.mute) wjsPlayer.vlc.mute = true;
		}
		return true;
	} else return false;
}

// player event handlers
function timePassed(wjsPlayer,t) {
	if (t > 0) wjsPlayer.wrapper.find(".wcp-time-current").text(parseTime(t,wjsPlayer.vlc.length));
	else if (wjsPlayer.wrapper.find(".wcp-time-current").text() != "") wjsPlayer.wrapper.find(".wcp-time-current").text("");
	
	if (typeof opts[wjsPlayer.context].subtitles === 'undefined') opts[wjsPlayer.context].subtitles = [];
	
	if (opts[wjsPlayer.context].subtitles.length > 0) {
		// End show subtitle text (external subtitles)
		var nowSecond = (t - opts[wjsPlayer.context].subDelay) /1000;
		if (opts[wjsPlayer.context].trackSub > -2) {
			var subtitle = -1;
			
			var os = 0;
			for (os in opts[wjsPlayer.context].subtitles) {
				if (os > nowSecond) break;
				subtitle = os;
			}
			
			if (subtitle > 0) {
				if(subtitle != opts[wjsPlayer.context].trackSub) {
					if ((opts[wjsPlayer.context].subtitles[subtitle].t.match(new RegExp("<", "g")) || []).length == 2) {
						if (!(opts[wjsPlayer.context].subtitles[subtitle].t.substr(0,1) == "<" && opts[wjsPlayer.context].subtitles[subtitle].t.slice(-1) == ">")) {
							opts[wjsPlayer.context].subtitles[subtitle].t = opts[wjsPlayer.context].subtitles[subtitle].t.replace(/<\/?[^>]+(>|$)/g, "");
						}
					} else if ((opts[wjsPlayer.context].subtitles[subtitle].t.match(new RegExp("<", "g")) || []).length > 2) {
						opts[wjsPlayer.context].subtitles[subtitle].t = opts[wjsPlayer.context].subtitles[subtitle].t.replace(/<\/?[^>]+(>|$)/g, "");
					}
					$(wjsPlayer.allElements[0]).find(".wcp-subtitle-text").html(nl2br(opts[wjsPlayer.context].subtitles[subtitle].t));
					opts[wjsPlayer.context].trackSub = subtitle;
				} else if (opts[wjsPlayer.context].subtitles[subtitle].o < nowSecond) {
					$(wjsPlayer.allElements[0]).find(".wcp-subtitle-text").html("");
				}
			}
		}
		// End show subtitle text (external subtitles)
	}

}
function positionChanged(wjsPlayer,position) {
	opts[this.context].lastPos = position;
	if (!seekDrag) wjsPlayer.wrapper.find(".wcp-progress-seen")[0].style.width = (position*100)+"%";
};

function isOpening(wjsPlayer) {
	if (wjsPlayer.vlc.playlist.currentItem != opts[wjsPlayer.context].lastItem) {
		opts[wjsPlayer.context].lastItem = wjsPlayer.vlc.playlist.currentItem;
		if (wjsPlayer.wrapper.find(".wcp-playlist").is(":visible")) {
			printPlaylist(wjsPlayer);
		}
		wjsPlayer.wrapper.find(".wcp-title")[0].innerHTML = wjsPlayer.vlc.playlist.items[wjsPlayer.vlc.playlist.currentItem].title.replace("[custom]","");
	}
	var style = window.getComputedStyle($(wjsPlayer.allElements[0]).find(".wcp-status")[0]);
	if (style.display === 'none') $(wjsPlayer.allElements[0]).find(".wcp-status").show();
	$(wjsPlayer.allElements[0]).find(".wcp-status").text("Opening");
};

function isMediaChanged(wjsPlayer) {

	$(wjsPlayer.allElements[0]).find(".wcp-subtitle-text").html("");
	opts[wjsPlayer.context].currentSub = 0;
	opts[wjsPlayer.context].subtitles = [];
	if (wjsPlayer.wrapper.find(".wcp-subtitles").is(":visible")) {
		wjsPlayer.wrapper.find(".wcp-subtitles").hide(0);
	}
	wjsPlayer.wrapper.find(".wcp-subtitle-but").hide(0);
	
	opts[wjsPlayer.context].firstTime = true;
}

function isBuffering(wjsPlayer,percent) {
	wjsPlayer.wrapper.find(".wcp-status").text("Buffering "+percent+"%");
	wjsPlayer.wrapper.find(".wcp-status").stop().show(0);
	if (percent == 100) wjsPlayer.wrapper.find(".wcp-status").fadeOut(1200);
};

function isPlaying(wjsPlayer) {
	if (opts[wjsPlayer.context].keepHidden) {
		opts[wjsPlayer.context].keepHidden = false;
		itemSetting = JSON.parse(wjsPlayer.vlc.playlist.items[wjsPlayer.vlc.playlist.currentItem].setting);
		if (itemSetting.zoom) {
			opts[wjsPlayer.context].zoom = itemSetting.zoom;
		} else {
			opts[wjsPlayer.context].zoom = 1;
			autoResize();
		}
	}
	if (opts[wjsPlayer.context].firstTime) {
		if (wjsPlayer.wrapper.find(".wcp-title").text() != wjsPlayer.vlc.playlist.items[wjsPlayer.vlc.playlist.currentItem].title.replace("[custom]","")) {
			wjsPlayer.wrapper.find(".wcp-title")[0].innerHTML = wjsPlayer.vlc.playlist.items[wjsPlayer.vlc.playlist.currentItem].title.replace("[custom]","");
		}
		opts[wjsPlayer.context].firstTime = false;
		if (wjsPlayer.vlc.subtitles.track > 0) wjsPlayer.vlc.subtitles.track = 0;
		opts[wjsPlayer.context].currentSub = 0;
		opts[wjsPlayer.context].trackSub = -1;
		totalSubs = wjsPlayer.vlc.subtitles.count;
		itemSetting = JSON.parse(wjsPlayer.vlc.playlist.items[wjsPlayer.vlc.playlist.currentItem].setting);
		
		// set default aspect ratio
		if (itemSetting.aspectRatio) {
			opts[wjsPlayer.context].aspectRatio = itemSetting.aspectRatio;
		} else {
			opts[wjsPlayer.context].aspectRatio = "Default";
			autoResize();
		}
		
		// set default crop
		if (itemSetting.crop) {
			opts[wjsPlayer.context].crop = itemSetting.crop;
		} else {
			opts[wjsPlayer.context].crop = "Default";
			autoResize();
		}
		
		// set default zoom
		if (itemSetting.zoom) {
			opts[wjsPlayer.context].zoom = itemSetting.zoom;
		} else {
			opts[wjsPlayer.context].zoom = 1;
			autoResize();
		}

		if (itemSetting.subtitles) totalSubs += Object.keys(itemSetting.subtitles).length;
		
		opts[wjsPlayer.context].subDelay = 0;
		
		if (totalSubs > 0) wjsPlayer.wrapper.find(".wcp-subtitle-but").show(0);
		
	}
	var style = window.getComputedStyle($(wjsPlayer.allElements[0]).find(".wcp-status")[0]);
	if (style.display !== 'none') $(wjsPlayer.allElements[0]).find(".wcp-status").fadeOut(1200);
};

function hasEnded(wjsPlayer) {
	wjsPlayer = players[wjsPlayer.context];
	opts[this.context].keepHidden = true;
	wjsPlayer.zoom(0);
	switchClass($(wjsPlayer.allElements[0]).find(".wcp-pause")[0],"wcp-pause","wcp-replay");
	if (wjsPlayer.vlc.time > 0) {
		if (opts[wjsPlayer.context].lastPos < 0.95) {
			// Reconnect if connection to server lost
			wjsPlayer.vlc.playlist.currentItem =opts[wjsPlayer.context].lastItem;
			wjsPlayer.vlc.playlist.play();
			wjsPlayer.vlc.position = opts[wjsPlayer.context].lastPos;

			wjs_button = this.wrapper.find(".wcp-play");
			if (wjs_button.length != 0) wjs_button.removeClass("wcp-play").addClass("wcp-pause");
			
			wjs_button = this.wrapper.find(".wcp-replay");
			if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-pause");

			positionChanged(wjsPlayer,0);
			wjsPlayer.wrapper.find(".wcp-time-current").text("");
			wjsPlayer.wrapper.find(".wcp-time-total").text("");
			// End Reconnect if connection to server lost
		} else {
			if (opts[wjsPlayer.context].loop && wjsPlayer.vlc.playlist.currentItem +1 == wjsPlayer.vlc.playlist.itemCount) {
				wjsPlayer.playItem(0);
			} else if (wjsPlayer.vlc.playlist.currentItem +1 < wjsPlayer.vlc.playlist.itemCount) {
				wjsPlayer.next();
			}
		}
	}
};
// end player event handlers

function singleResize(wjsPlayer,width,height) {

	wjsPlayer.canvas.width = width;
	wjsPlayer.canvas.height = height;

	var container = $(wjsPlayer.context);
	if (opts[wjsPlayer.context].aspectRatio != "Default" && opts[wjsPlayer.context].aspectRatio.indexOf(":") > -1) {
		var res = opts[wjsPlayer.context].aspectRatio.split(":");
		var ratio = gcd(wjsPlayer.canvas.width,wjsPlayer.canvas.height);
	}
	var destAspect = container.width() / container.height();
	
	if (ratio) var sourceAspect = (ratio * parseFloat(res[0])) / (ratio * parseFloat(res[1]));
	else var sourceAspect = wjsPlayer.canvas.width / wjsPlayer.canvas.height;
	
	if (opts[wjsPlayer.context].crop != "Default" && opts[wjsPlayer.context].crop.indexOf(":") > -1) {
		var res = opts[wjsPlayer.context].crop.split(":");
		var ratio = gcd(wjsPlayer.canvas.width,wjsPlayer.canvas.height);
		var sourceAspect = (ratio * parseFloat(res[0])) / (ratio * parseFloat(res[1]));
	}



	var cond = destAspect > sourceAspect;
	
	if (opts[wjsPlayer.context].crop != "Default" && opts[wjsPlayer.context].crop.indexOf(":") > -1) {
		if (cond) {
			$(wjsPlayer.canvas).parent()[0].style.height = (100*opts[wjsPlayer.context].zoom)+"%";
			$(wjsPlayer.canvas).parent()[0].style.width = ( ((container.height() * sourceAspect) / container.width() ) * 100 *opts[wjsPlayer.context].zoom) + "%";
		} else {
			$(wjsPlayer.canvas).parent()[0].style.height = ( ((container.width() / sourceAspect) /container.height() ) * 100*opts[wjsPlayer.context].zoom) + "%";
			$(wjsPlayer.canvas).parent()[0].style.width = (100*opts[wjsPlayer.context].zoom)+"%";
		}
		var sourceAspect = wjsPlayer.canvas.width / wjsPlayer.canvas.height;
		if ((parseInt($(wjsPlayer.canvas).parent()[0].style.width) /100 * container.width()) > (parseInt($(wjsPlayer.canvas).parent()[0].style.height) /100 * container.height())) {
			wjsPlayer.canvas.style.height = ( (((parseInt($(wjsPlayer.canvas).parent()[0].style.width) /100 * container.width()) / sourceAspect) /(parseInt($(wjsPlayer.canvas).parent()[0].style.height) /100 * container.height()) ) *opts[wjsPlayer.context].zoom*(parseInt($(wjsPlayer.canvas).parent()[0].style.height) /100 * container.height())) + "px";
			wjsPlayer.canvas.style.width = (parseInt($(wjsPlayer.canvas).parent()[0].style.width) /100 * container.width())+"px";
		} else {
			wjsPlayer.canvas.style.height = container.height()+"px";
			wjsPlayer.canvas.style.width = ( ((container.height() * sourceAspect) / container.width() ) *opts[wjsPlayer.context].zoom *container.width()) + "px";
		}
	} else {
		if (cond) {
			$(wjsPlayer.canvas).parent()[0].style.height = (100*opts[wjsPlayer.context].zoom)+"%";
			$(wjsPlayer.canvas).parent()[0].style.width = ( ((container.height() * sourceAspect) / container.width() ) * 100 *opts[wjsPlayer.context].zoom) + "%";
			wjsPlayer.canvas.style.height = "100%";
			wjsPlayer.canvas.style.width = "100%";
		} else {
			$(wjsPlayer.canvas).parent()[0].style.height = ( ((container.width() / sourceAspect) /container.height() ) * 100*opts[wjsPlayer.context].zoom) + "%";
			$(wjsPlayer.canvas).parent()[0].style.width = (100*opts[wjsPlayer.context].zoom)+"%";
			wjsPlayer.canvas.style.height = "100%";
			wjsPlayer.canvas.style.width = "100%";
		}
	}
}

function autoResize() {
	$('.webchimeras').each(function(i, obj) {
		if ($(obj).find(".wcp-wrapper")[0]) {
			var wjsPlayer = wjs("#"+$(obj).find(".wcp-wrapper")[0].id);

			// resize status font size
			if (wjsPlayer.wrapper.width() <= 220) fontSize = 5;
			else if (wjsPlayer.wrapper.width() > 220 && wjsPlayer.wrapper.width() <= 982) fontSize = ((wjsPlayer.wrapper.width() -220) /40) +9;
			else fontSize = (parseInt($(wjsPlayer.allElements[0]).height())/15);

			if (fontSize < 16) fontSize = 16;
			else if (fontSize > 31) fontSize = 31;

			$(wjsPlayer.allElements[0]).find(".wcp-status").css('fontSize', fontSize);
			$(wjsPlayer.allElements[0]).find(".wcp-notif").css('fontSize', fontSize);
			$(wjsPlayer.allElements[0]).find(".wcp-subtitle-text").css('fontSize', fontSize);

			singleResize(wjsPlayer,wjsPlayer.canvas.width,wjsPlayer.canvas.height);
		}
	});
}

function hasClass(el,check) { 
	if (el) return el.classList.contains(check);
	else return false;
}

function switchClass(el,fclass,sclass) {
	if (hasClass(el,fclass)) {
		el.classList.remove(fclass);
		el.classList.add(sclass);
	}
}

function parseTime(t,total) {
	if (typeof total === 'undefined') total = t;
	var tempHour = ("0" + Math.floor(t / 3600000)).slice(-2);
	var tempMinute = ("0" + (Math.floor(t / 60000) %60)).slice(-2);
	var tempSecond = ("0" + (Math.floor(t / 1000) %60)).slice(-2);

	if (total >= 3600000) {
		return tempHour + ":" + tempMinute + ":" + tempSecond;
	} else {
		return tempMinute + ":" + tempSecond;
	}
}

function wcp_hideUI(wjsWrapper) {
	if (!(vlcs["#"+wjsWrapper.find(".wcp-wrapper")[0].id].multiscreen && window.document.webkitFullscreenElement == null)) {
		if (seekDrag || volDrag || ($(wjsWrapper.find(".wcp-toolbar").selector + ":hover").length > 0 && vlcs["#"+wjsWrapper.find(".wcp-wrapper")[0].id].timestampUI + 20 > Math.floor(Date.now() / 1000))) {
			vlcs["#"+wjsWrapper.find(".wcp-wrapper")[0].id].hideUI = setTimeout(function(i) { return function() { wcp_hideUI(i); } }(wjsWrapper),3000);
			return;
		}
		if (window.document.webkitFullscreenElement == null) {
			if (opts["#"+wjsWrapper.find(".wcp-wrapper")[0].id].titleBar == "both" || opts["#"+wjsWrapper.find(".wcp-wrapper")[0].id].titleBar == "minimized") {
				wjsWrapper.find(".wcp-titlebar").stop().fadeOut();
				
			}
		} else {
			if (opts["#"+wjsWrapper.find(".wcp-wrapper")[0].id].titleBar == "both" || opts["#"+wjsWrapper.find(".wcp-wrapper")[0].id].titleBar == "fullscreen") {
				wjsWrapper.find(".wcp-titlebar").stop().fadeOut();
			}
		}
		wjsWrapper.find(".wcp-toolbar").stop().fadeOut();
		wjsWrapper.find(".wcp-tooltip").stop().fadeOut();
		wjsWrapper.find(".wcp-wrapper").css({cursor: 'none'});
	}
}

function wcp_showPlaylist(wjsPlayer) {
	if (!wjsPlayer.wrapper.find(".wcp-playlist").is(":visible")) {
		if (wjsPlayer.wrapper.find(".wcp-subtitles").is(":visible")) {
			wjsPlayer.wrapper.find(".wcp-subtitles").hide(0);
		}
		printPlaylist(wjsPlayer);
		wjsPlayer.wrapper.find(".wcp-playlist").show(0);
		playlistItems = wjsPlayer.wrapper.find(".wcp-playlist-items");
		if (playlistItems.outerHeight() <= (oi* parseInt(playlistItems.find(".wcp-playlist-item").css("height")))) {
			playlistItems.css("cursor","pointer");
		} else playlistItems.css("cursor","default");
	}
}

function wcp_hidePlaylist(wjsPlayer) {
	if (wjsPlayer.wrapper.find(".wcp-playlist").is(":visible")) {
		$(".wcp-playlist-items").sortable("destroy");
		wjsPlayer.wrapper.find(".wcp-playlist").hide(0);
	}
}


function wcp_showSubtitles(wjsPlayer) {
	if (!wjsPlayer.wrapper.find(".wcp-subtitles").is(":visible")) {
		if (wjsPlayer.wrapper.find(".wcp-playlist").is(":visible")) {
			$(".wcp-playlist-items").sortable("destroy");
			wjsPlayer.wrapper.find(".wcp-playlist").hide(0);
		}
		printSubtitles(wjsPlayer);
		wjsPlayer.wrapper.find(".wcp-subtitles").show(0);
		playlistItems = wjsPlayer.wrapper.find(".wcp-subtitles-items");
		if (playlistItems.outerHeight() <= (oi* parseInt(playlistItems.find(".wcp-subtitles-item").css("height")))) {
			playlistItems.css("cursor","pointer");
		} else playlistItems.css("cursor","default");
	}
}

function wcp_hideSubtitles(wjsPlayer) {
	if (wjsPlayer.wrapper.find(".wcp-subtitles").is(":visible")) {
		wjsPlayer.wrapper.find(".wcp-subtitles").hide(0);
	}
}

function printPlaylist(wjsPlayer) {
	playlistItems = wjsPlayer.wrapper.find(".wcp-playlist-items");
	vlc = vlcs["#"+wjsPlayer.wrapper[0].id].vlc;
	oi = 0;
	if (vlc.playlist.itemCount > 0) {
		generatePlaylist = "";
		for (oi = 0; oi < vlc.playlist.itemCount; oi++) {
			if (vlc.playlist.items[oi].title.indexOf("[custom]") != 0) {
				var plstring = vlc.playlist.items[oi].title;
				if (plstring.indexOf("http://") == 0) {
					// extract filename from url
					var tempPlstring = plstring.substring(plstring.lastIndexOf('/')+1);
					if (tempPlstring.length > 3) plstring = tempPlstring;
					delete tempPlstring;
				}
				if (plstring.indexOf(".") > -1) {
					// remove extension
					var tempPlstring = plstring.replace("."+plstring.split('.').pop(),"");
					if (tempPlstring.length > 3) plstring = tempPlstring;
					delete tempPlstring;
				}
				plstring = unescape(plstring);
				plstring = plstring.split('_').join(' ');
				plstring = plstring.split('.').join(' ');
				plstring = plstring.split('  ').join(' ');
				plstring = plstring.split('  ').join(' ');
				plstring = plstring.split('  ').join(' ');
				
				// capitalize first letter
				plstring = plstring.charAt(0).toUpperCase() + plstring.slice(1);
	
				if (plstring != vlc.playlist.items[oi].title) vlc.playlist.items[oi].title = "[custom]"+plstring;
			}
			generatePlaylist += '<li class="wcp-menu-item wcp-playlist-item';
			if (oi == vlc.playlist.currentItem) generatePlaylist += ' wcp-menu-selected';
			if (vlc.playlist.items[oi].disabled) generatePlaylist += ' wcp-disabled';
			generatePlaylist += '"><img class="wcp-disabler-img" src="'+relbase+'/images/dragger.png"><div class="wcp-disabler-hold"><div class="wcp-disabler"><div class="wcp-disabler-dot"></div></div></div>'+vlc.playlist.items[oi].title.replace("[custom]","")+'</li>';
		}
		playlistItems.css('overflowY', 'scroll');
		playlistItems.html("");
		playlistItems.html(generatePlaylist);
		wjsPlayer.wrapper.find(".wcp-disabler-hold").click(function(e) {
			if (!e) var e = window.event;
			e.cancelBubble = true;
			if (e.stopPropagation) e.stopPropagation();
			plItem = $(this).parent();
			wjsPlayer = players["#"+$(this).parents(".wcp-wrapper")[0].id];
			if (!plItem.hasClass("wcp-menu-selected")) {
				if (!wjsPlayer.vlc.playlist.items[plItem.index()].disabled) {
					plItem.addClass("wcp-disabled");
					wjsPlayer.vlc.playlist.items[plItem.index()].disabled = true;
				} else {
					plItem.removeClass("wcp-disabled");
					wjsPlayer.vlc.playlist.items[plItem.index()].disabled = false;
				}
			}
		});
		wjsPlayer.wrapper.find(".wcp-playlist-item").click(function() {
			if (!$(this).hasClass("wcp-menu-selected")) {
				wjsPlayer = players["#"+$(this).parents(".wcp-wrapper")[0].id];
				if (wjsPlayer.vlc.playlist.items[$(this).index()].disabled) {
					wjsPlayer.vlc.playlist.items[$(this).index()].disabled = false;
					$(this).removeClass("wcp-disabled");
				}
				opts["#"+$(this).parents(".wcp-wrapper")[0].id].keepHidden = true;
				wjsPlayer.zoom(0);
				
				wjs_button = $(wjs("#"+$(this).parents(".wcp-wrapper")[0].id).canvas).parents(".wcp-wrapper").find(".wcp-play");
				if (wjs_button.length != 0) wjs_button.removeClass("wcp-play").addClass("wcp-pause");
				
				wjs_button = $(wjs("#"+$(this).parents(".wcp-wrapper")[0].id).canvas).parents(".wcp-wrapper").find(".wcp-replay");
				if (wjs_button.length != 0) wjs_button.removeClass("wcp-replay").addClass("wcp-pause");
				
				positionChanged(wjs("#"+$(this).parents(".wcp-wrapper")[0].id),0);
				$(wjs("#"+$(this).parents(".wcp-wrapper")[0].id).canvas).parents(".wcp-wrapper").find(".wcp-time-current").text("");
				$(wjs("#"+$(this).parents(".wcp-wrapper")[0].id).canvas).parents(".wcp-wrapper").find(".wcp-time-total").text("");
				
				vlcs["#"+$(this).parents(".wcp-wrapper")[0].id].vlc.playlist.playItem(parseInt($(this).index()));
				printPlaylist(wjs("#"+$(this).parents(".wcp-wrapper")[0].id));
			}
		});
		wjsPlayer.wrapper.find(".wcp-playlist-items").sortable({
		  placeholder: "sortable-placeholder",
		  delay: 250,
		  start: function(e,ui) {
			  $(ui.item[0]).addClass("sortable-dragging");
			  var start_pos = ui.item.index();
              ui.item.data('start_pos', start_pos);
		  },
		  stop: function(e,ui) {
			  $(this).parents(".wcp-wrapper").find(".sortable-dragging").removeClass("sortable-dragging");
		  },
		  update: function(e,ui) {
			  var start_pos = ui.item.data('start_pos');
			  var end_pos = ui.item.index();
			  players["#"+$(this).parents(".wcp-wrapper")[0].id].vlc.playlist.advanceItem(start_pos,(end_pos - start_pos));
		  }
		});
	} else playlistItems.html("");
}

function printSubtitles(wjsPlayer) {
	playlistItems = wjsPlayer.wrapper.find(".wcp-subtitles-items");

	generatePlaylist = "";
	generatePlaylist += '<li class="wcp-menu-item wcp-subtitles-item';
	if (opts[wjsPlayer.context].currentSub == 0) generatePlaylist += ' wcp-menu-selected';
	generatePlaylist += '">None</li>';
	if (wjsPlayer.vlc.subtitles.count > 0) {
		for (oi = 1; oi < wjsPlayer.vlc.subtitles.count; oi++) {
			generatePlaylist += '<li class="wcp-menu-item wcp-subtitles-item';
			if (oi == opts[wjsPlayer.context].currentSub) generatePlaylist += ' wcp-menu-selected';
			generatePlaylist += '">'+wjsPlayer.vlc.subtitles[oi]+'</li>';
		}
	} else oi = 1;

	itemSetting = JSON.parse(wjsPlayer.vlc.playlist.items[wjsPlayer.vlc.playlist.currentItem].setting);
	
	if (itemSetting.subtitles) {
		target = itemSetting.subtitles;
		for (var k in target) if (target.hasOwnProperty(k)) {
			generatePlaylist += '<li class="wcp-menu-item wcp-subtitles-item';
			if (oi == opts[wjsPlayer.context].currentSub) generatePlaylist += ' wcp-menu-selected';
			generatePlaylist += '">'+k+'</li>';
			oi++;
		}
	}

	playlistItems.html("");
	playlistItems.html(generatePlaylist);
	
	wjsPlayer.wrapper.find(".wcp-subtitles-item").click(function() {
		wrapperId = $(this).parents(".wcp-wrapper")[0].id;
		if ($(this).index() == 0) {
			vlcs["#"+wrapperId].vlc.subtitles.track = 0;
			clearSubtitles(wjs("#"+wrapperId));
			players["#"+wrapperId].notify("Subtitle Unloaded");
		} else if ($(this).index() < vlcs["#"+wrapperId].vlc.subtitles.count) {
			$(wjsPlayer.allElements[0]).find(".wcp-subtitle-text").html("");
			opts[wjsPlayer.context].subtitles = [];
			vlcs["#"+wrapperId].vlc.subtitles.track = $(this).index();
			players["#"+wrapperId].notify("Subtitle: "+players["#"+wrapperId].subDesc($(this).index()).language);
		} else {
			$(wjsPlayer.allElements[0]).find(".wcp-subtitle-text").html("");
			opts[wjsPlayer.context].subtitles = [];
			if (wjsPlayer.vlc.subtitles.track > 0) wjsPlayer.vlc.subtitles.track = 0;
			newSub = $(this).index() - vlcs["#"+wrapperId].vlc.subtitles.count +1;
			target = itemSetting.subtitles;
			for (var k in target) if (target.hasOwnProperty(k)) {
				newSub--;
				if (newSub == 0) {
					loadSubtitle(wjs("#"+wrapperId),target[k]);
					players["#"+wrapperId].notify("Subtitle: "+k);
					break;
				}
			}
		}
		players["#"+wrapperId].wrapper.find(".wcp-subtitles").hide(0);
		opts["#"+wrapperId].currentSub = $(this).index();
		opts["#"+wrapperId].subDelay = 0;
	});
	
}

function clearSubtitles(wjsPlayer) {
	$(wjsPlayer.allElements[0]).find(".wcp-subtitle-text").html("");
	opts[wjsPlayer.context].currentSub = 0;
	opts[wjsPlayer.context].subtitles = [];
	if (wjsPlayer.vlc.subtitles.track > 0) wjsPlayer.vlc.subtitles.track = 0;
	if (wjsPlayer.wrapper.find(".wcp-subtitles").is(":visible")) printSubtitles(wjsPlayer);
}

function loadSubtitle(wjsPlayer,subtitleElement) {
	if (typeof opts[wjsPlayer.context].subtitles === "undefined") opts[wjsPlayer.context].subtitles = [];
	else if (opts[wjsPlayer.context].subtitles.length) { opts["#"+wrapperId].subtitles = []; opts[wjsPlayer.context].subtitles = []; }

	if (subtitleElement.indexOf("http://dl.opensubtitles.org/") == 0) subtitleElement = "http://dl.opensubtitles.org/en/download/subencoding-utf8/file/"+subtitleElement.split('/').pop();

	resData = "";
	var req = http.get(subtitleElement , function(res) {
			res.on('data', function (data) {
			   resData += data;
			});

			res.on('end', function() {
				var srt = resData;
				opts[wjsPlayer.context].subtitles = [];
				
				var extension = subtitleElement.split('.').pop();
				if (extension.toLowerCase() == "srt" || extension.toLowerCase() == "vtt") {
			
					srt = strip(srt.replace(/\r\n|\r|\n/g, '\n'));
			
					var srty = srt.split('\n\n'),
						si = 0;
					
					if (srty[0].substr(0,6).toLowerCase() == "webvtt") si = 1;
			
					for (s = si; s < srty.length; s++) {
						var st = srty[s].split('\n');
						if (st.length >=2) {
							var n = -1;
							if (st[0].indexOf(' --> ') > -1) var n = 0;
							else if (st[1].indexOf(' --> ') > -1) var n = 1;
							else if (st[2].indexOf(' --> ') > -1)  var n = 2;
							else if (st[3].indexOf(' --> ') > -1)  var n = 3;
							if (n > -1) {
								stOrigin = st[n]
								var is = Math.round(toSeconds(strip(stOrigin.split(' --> ')[0])));
								var os = Math.round(toSeconds(strip(stOrigin.split(' --> ')[1])));
								var t = st[n+1];
								if (st.length > n+2) for (j=n+2; j<st.length; j++) t = t + '\n'+st[j];
								opts[wjsPlayer.context].subtitles[is] = {i:is, o: os, t: t};
							}
						}
					}
				} else if (extension.toLowerCase() == "sub") {
					srt = srt.replace(/\r\n|\r|\n/g, '\n');
					
					srt = strip(srt);
					var srty = srt.split('\n');
	
					var s = 0;
					for (s = 0; s < srty.length; s++) {
						var st = srty[s].split('}{');
						if (st.length >=2) {
						  var is = Math.round(st[0].substr(1) /10);
						  var os = Math.round(st[1].split('}')[0] /10);
						  var t = st[1].split('}')[1].replace('|', '\n');
						  if (is != 1 && os != 1) opts[wjsPlayer.context].subtitles[is] = {i:is, o: os, t: t};
						}
					}
				}
				opts[wjsPlayer.context].trackSub = -1;
			});
	});
}

function toSeconds(t) {
	var s = 0.0
	if (t) {
		var p = t.split(':');
		var i = 0;
		for (i=0;i<p.length;i++) s = s * 60 + parseFloat(p[i].replace(',', '.'))
	}
	return s;
}

function strip(s) {
	return s.replace(/^\s+|\s+$/g,"");
}

function nl2br(str,is_xhtml) {
    var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';
    return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}

function gcd(a,b) {if(b>a) {temp = a; a = b; b = temp} while(b!=0) {m=a%b; a=b; b=m;} return a;}

function preventSleep() {
	if (typeof powerSaveBlocker !== 'undefined') {
		if (typeof sleepId === 'undefined' || !powerSaveBlocker.isStarted(sleepId)) sleepId = powerSaveBlocker.start('prevent-display-sleep');
	} else sleep.prevent();
}

function allowSleep() {
	if (typeof powerSaveBlocker !== 'undefined') {
		if (powerSaveBlocker.isStarted(sleepId)) powerSaveBlocker.stop(sleepId);
	} else sleep.allow();
}

module.exports = wjs;