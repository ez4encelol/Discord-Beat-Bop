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

> All commands start with `/`

| Command   | Description                            | Options                     |
| --------- | -------------------------------------- | --------------------------- |
| `/play`   | Play a YouTube video by URL            | `url` (string, required)    |
| `/skip`   | Skip the currently playing track       | None                        |
| `/loop`   | Toggle loop mode (repeat current song) | None                        |
| `/pause`  | Pause playback                         | None                        |
| `/resume` | Resume playback                        | None                        |
| `/stop`   | Stop playback and leave voice channel  | None                        |
| `/volume` | Set playback volume (0–100%)           | `level` (integer, required) |
| `/queue`  | Show the current music queue           | None                        |
| `/clear`  | Clear the current music queue          | None                        |


---

## 🎧 How It Works

1. When a user types `/play <YouTube URL>` in a text channel:
   - If nothing is playing, the bot joins the user's voice channel and plays the audio.
   - If something is already playing, it adds the song to the **queue**.

2. The bot uses `yt-dlp` to stream raw audio from YouTube and pipes it through `ffmpeg` to Discord.

3. Commands like `/skip`, `/loop`, `/pause`, and `/volume` manipulate the current playback or queue.

4. If looping is enabled via `/loop`, the same song repeats when it ends.

5. The bot automatically leaves the voice channel when playback ends and the queue is empty.

---

## 🛠 Requirements

- [Node.js](https://nodejs.org/en/) v18 or higher
- `ffmpeg` (bundled via [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static))
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) installed and accessible in your system PATH
- Discord bot token and application registered on the [Discord Developer Portal](https://discord.com/developers/applications)

---

## 💡 To-do list

Allow the bot to play from:
  - Playlists
  - Spotify links
  - Web UI for queue management
