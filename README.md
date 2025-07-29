# 🎶 Discord Music Bot

## 📌 Overview

This Discord bot allows users to **play YouTube audio**, manage a **music queue**, adjust **volume**, loop songs, and control playback directly from a voice channel using text commands.

It uses:
- `discord.js` for Discord integration
- `@discordjs/voice` for voice playback
- `yt-dlp` to stream YouTube audio
- `ffmpeg` for audio processing

---

## 🚀 Features

- 🔊 Stream YouTube audio directly into voice channels
- ⏱ Maintain a queue of songs per server
- 🔁 Loop the current track
- ⏸ Pause/resume playback
- ⏭ Skip current track
- 🎚 Control volume
- ❌ Stop and disconnect from voice
- 🧹 Clear the music queue

---

## 💬 Commands

> All commands start with `!`

| Command             | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| `!play <url>`       | Plays the YouTube audio from the given link. Adds to the queue if something is already playing. |
| `!skip`             | Skips the current track.                                                    |
| `!loop`             | Toggles looping the currently playing song.                                 |
| `!pause`            | Pauses the current playback.                                                |
| `!resume`           | Resumes playback if paused.                                                 |
| `!volume <0.0–2.0>` | Sets the playback volume (1.0 = 100%, 0.5 = 50%, 2.0 = 200%).                |
| `!stop`             | Stops playback and disconnects from the voice channel.                      |
| `!clear`            | Clears the current music queue (does not stop the currently playing song).  |

---

## 🎧 How It Works

1. When a user types `!play <YouTube URL>` in a text channel:
   - If nothing is playing, the bot joins the user's voice channel and plays the audio.
   - If something is already playing, it adds the song to the **queue**.

2. The bot uses `yt-dlp` to stream raw audio from YouTube and pipes it through `ffmpeg` to Discord.

3. Commands like `!skip`, `!loop`, `!pause`, and `!volume` manipulate the current playback or queue.

4. If looping is enabled via `!loop`, the same song repeats when it ends.

5. The bot automatically leaves the voice channel when playback ends and the queue is empty.

---

## 🛠 Requirements

Make sure the following are properly installed and configured:

- ✅ [Node.js](https://nodejs.org/)
- ✅ [`yt-dlp`](https://github.com/yt-dlp/yt-dlp#installation)
- ✅ [`ffmpeg`](https://ffmpeg.org/download.html) and added to your system PATH
- ✅ Correct Discord bot token and appropriate **Intents** enabled in the Discord Developer Portal
- ✅ `MESSAGE CONTENT INTENT` enabled in bot settings

---

## 💡 Tips

- Keep your bot token secret at all times.
- You can extend this bot to support:
  - Slash commands
  - Playlists
  - Spotify links
  - Web UI for queue management
