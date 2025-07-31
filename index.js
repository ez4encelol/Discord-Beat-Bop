require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const guildAudioData = new Map();

// ----- Register Slash Commands -----
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder().setName('play').setDescription('Play a YouTube video')
      .addStringOption(option => option.setName('url').setDescription('YouTube URL').setRequired(true)),
    new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
    new SlashCommandBuilder().setName('loop').setDescription('Toggle loop mode'),
    new SlashCommandBuilder().setName('pause').setDescription('Pause the audio'),
    new SlashCommandBuilder().setName('resume').setDescription('Resume the audio'),
    new SlashCommandBuilder().setName('stop').setDescription('Stop the audio and leave the voice channel'),
    new SlashCommandBuilder().setName('volume').setDescription('Set volume (0–100)')
      .addIntegerOption(option => option.setName('level').setDescription('Volume %').setRequired(true)),
    new SlashCommandBuilder().setName('queue').setDescription('Show the current queue'),
    new SlashCommandBuilder().setName('clear').setDescription('Clear the queue'),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('📡 Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
}

// ----- Music Logic -----
async function playAudio(interaction, url) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) return interaction.reply({ content: '🔊 You must be in a voice channel.', ephemeral: true });

  let data = guildAudioData.get(interaction.guildId);
  if (!data) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    data = {
      connection,
      player,
      queue: [],
      loop: false,
      volume: 1.0,
      playing: false,
      ytdlpProcess: null,
      ffmpegProcess: null,
    };
    guildAudioData.set(interaction.guildId, data);

    player.on(AudioPlayerStatus.Idle, () => {
      if (data.loop && data.queue.length > 0) {
        playStream(data, data.queue[0].url, interaction);
      } else if (data.queue.length > 1) {
        data.queue.shift();
        playStream(data, data.queue[0].url, interaction);
      } else {
        data.playing = false;
        data.connection.destroy();
        guildAudioData.delete(interaction.guildId);
      }
    });

    player.on('error', err => {
      console.error('Audio error:', err);
      data.playing = false;
    });
  }

  data.queue.push({ url });
  interaction.reply(`▶️ Added to queue: ${url}`);

  if (!data.playing) {
    playStream(data, url, interaction);
  }
}

function playStream(data, url, interaction) {
  // Kill existing streaming processes if any
  if (data.ytdlpProcess) {
    try { data.ytdlpProcess.kill('SIGKILL'); } catch {}
    data.ytdlpProcess = null;
  }
  if (data.ffmpegProcess) {
    try { data.ffmpegProcess.kill('SIGKILL'); } catch {}
    data.ffmpegProcess = null;
  }

  // Spawn yt-dlp and ffmpeg processes
  const ytdlpProcess = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', url]);
  const ffmpegProcess = spawn(ffmpeg, ['-i', 'pipe:0', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']);

  // Pipe yt-dlp output to ffmpeg input
  ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);

  // Add error handlers to prevent uncaught exceptions on skip or stop
  ytdlpProcess.stdout.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('yt-dlp stdout error:', err);
  });

  ffmpegProcess.stdin.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('ffmpeg stdin error:', err);
  });

  ffmpegProcess.stdout.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('ffmpeg stdout error:', err);
  });

  ytdlpProcess.on('error', (err) => {
    console.error('yt-dlp process error:', err);
  });

  ffmpegProcess.on('error', (err) => {
    console.error('ffmpeg process error:', err);
  });

  ytdlpProcess.on('close', (code, signal) => {
    if (code !== 0) console.error(`yt-dlp exited with code ${code} and signal ${signal}`);
  });

  ffmpegProcess.on('close', (code, signal) => {
    if (code !== 0) console.error(`ffmpeg exited with code ${code} and signal ${signal}`);
  });

  data.ytdlpProcess = ytdlpProcess;
  data.ffmpegProcess = ffmpegProcess;

  const resource = createAudioResource(ffmpegProcess.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: true,
  });
  resource.volume.setVolume(data.volume);

  data.player.play(resource);
  data.playing = true;
}

// ----- Handle Commands -----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const data = guildAudioData.get(interaction.guildId);

  switch (interaction.commandName) {
    case 'play':
      return playAudio(interaction, interaction.options.getString('url'));

    case 'skip':
      if (!data) return interaction.reply('❌ Nothing to skip.');

      data.player.stop();

      // Kill streaming processes immediately
      if (data.ytdlpProcess) {
        try { data.ytdlpProcess.kill('SIGKILL'); } catch {}
        data.ytdlpProcess = null;
      }
      if (data.ffmpegProcess) {
        try { data.ffmpegProcess.kill('SIGKILL'); } catch {}
        data.ffmpegProcess = null;
      }

      return interaction.reply('⏭ Skipped.');

    case 'loop':
      if (!data) return interaction.reply('❌ Nothing is playing.');
      data.loop = !data.loop;
      return interaction.reply(`🔁 Loop is now **${data.loop ? 'on' : 'off'}**.`);

    case 'pause':
      if (!data || !data.playing) return interaction.reply('❌ Nothing is playing.');
      data.player.pause();
      return interaction.reply('⏸ Paused.');

    case 'resume':
      if (!data || !data.playing) return interaction.reply('❌ Nothing to resume.');
      data.player.unpause();
      return interaction.reply('▶️ Resumed.');

    case 'stop':
      if (!data) return interaction.reply('❌ Not connected.');
      data.player.stop();
      data.connection.destroy();
      guildAudioData.delete(interaction.guildId);
      return interaction.reply('🛑 Stopped and left channel.');

    case 'volume':
      if (!data) return interaction.reply('❌ Nothing is playing.');
      const level = interaction.options.getInteger('level');
      if (level < 0 || level > 100) return interaction.reply('❌ Volume must be 0–100.');
      data.volume = level / 100;
      if (data.player.state.status === AudioPlayerStatus.Playing) {
        data.player.state.resource.volume.setVolume(data.volume);
      }
      return interaction.reply(`🔊 Volume set to ${level}%`);

    case 'queue':
      if (!data || data.queue.length === 0) return interaction.reply('🪹 Queue is empty.');
      const list = data.queue.map((item, i) => `${i + 1}. ${item.url}`).join('\n');
      return interaction.reply(`📃 **Queue:**\n${list}`);

    case 'clear':
      if (!data) return interaction.reply('🧹 Nothing to clear.');
      data.queue = [];
      return interaction.reply('✅ Queue cleared.');
  }
});

// ----- Start Bot -----
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

(async () => {
  await registerSlashCommands();
  client.login(TOKEN);
})();
