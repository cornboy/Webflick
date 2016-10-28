exports.create = function(self, streamURL, hostname, params) {
  var getport = require('getport');
  var request = require('request');
  var AdmZip = require('adm-zip');
  var http = require('http');
  var fs = require('fs');
  var opensrt = require('opensrt_js');
  var _ = require('underscore');

  var isWin = process.platform === 'win32';

  getport(8889, 8999, function (e, port) {
    if (e) {
      self.redirect('/');
    } else {
      var osSpecificCommand = isWin ? 'cmd' : 'peerflix';
      var osSpecificArgs = isWin ? ['/c', 'peerflix', decodeURIComponent(params.file),  '--port=' + port] : [decodeURIComponent(params.file),  '--port=' + port, '-r', '-f /root/torrent'];
      var childStream = require('child')({
        command: osSpecificCommand,
        args: osSpecificArgs,
        options: [],
        cbStdout: function(data) {
          console.log(String(data));
        }
      });

      streamURL = "http://" + "89.234.182.70" + ":" + port;
      var subtitles = {};

      // if it's a movie
      request('https://yts.ag/api/v2/movie_details.json?with_images=true&movie_id=' + params.id, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var yifyResponse = JSON.parse(body);

          var data = {};
          data.title = yifyResponse.data.movie.title;
          data.seeds = yifyResponse.data.movie.torrents[0].seeds;
          data.peers = yifyResponse.data.movie.torrents[0].peers;

          // IMAGE : MEDIUM
          data.cover = yifyResponse.data.movie.medium_cover_image;

          // fetch subtitles
          request('http://api.yifysubtitles.com/subs/' + yifyResponse.data.movie.imdb_code, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              var yifySubsResponse = JSON.parse(body);

              // download a subtitle
              function fetchSub (url, dest, lang, callBack) {
                var file = fs.createWriteStream(dest);
                var request = http.get(url, function(response) {
                  response.pipe(file);
                  file.on('finish', function() {
                    file.close(callBack(dest, lang));
                  });
                });
              }

              // unzip
              function unzip (dest, lang) {
                var zip = new AdmZip(dest);
                var zipEntries = zip.getEntries();

                zipEntries.forEach(function(zipEntry) {
                    var fileName = zipEntry.entryName.toString();
                    var i = fileName.lastIndexOf('.');
                    if (fileName.substr(i) == '.srt') { // Only unzip the srt file
                      var dir = "public/subtitles/" + yifyResponse.data.movie.title + '/';
                      zip.extractEntryTo(fileName, dir , false, true);
                      fs.renameSync(dir + fileName, dir + lang + '.srt'); // Rename to language.srt
                    }
                    fs.unlinkSync(dest); // Remove the zip
                });
              }

              for (var subs in yifySubsResponse.subs) {
                for (var lang in yifySubsResponse.subs[subs]) {
                  var subUrl = 'http://www.yifysubtitles.com' + _.max(yifySubsResponse.subs[subs][lang], function(s){return s.rating;}).url
                  fetchSub(subUrl, 'public/subtitles/' + lang + '.zip', lang, unzip);
                  // Build the subtitle url
                  subtitles[lang] = 'http://' + hostname + ':' + geddy.config.port + '/subtitles/';
                  subtitles[lang] += encodeURIComponent(yifyResponse.data.movie.title) + '/' + lang + '.srt';
                }
              }

              childStream.start(function(pid){
                geddy.config.streamingProcesses.push({
                  pid: pid,
                  child: childStream,
                  torrent: decodeURIComponent(params.file),
                  stream: streamURL,
                  data: data,
                  subtitles: subtitles
                });
              });

              self.respond({
                params: params,
                streamURL: streamURL,
                subtitles: subtitles
              }, {
                format: 'html',
                template: 'app/views/main/stream'
              });
            }
          });
        }
      });
    }
  });
};
