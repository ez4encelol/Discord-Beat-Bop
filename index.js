require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
} = require('@discordjs/voice');
const ytdlp = require('yt-dlp-exec'); // yt-dlp as Node wrapper

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

// ----- yt-dlp helper -----
async function getDirectAudioUrl(url) {
  try {
    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noPlaylist: true,
      format: 'bestaudio',
    });
    return info.url; // direct audio URL
  } catch (err) {
    console.error('yt-dlp exec error:', err);
    return null;
  }
}

// ----- Music Logic -----
async function playAudio(interaction, url) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '🔊 You must be in a voice channel.', ephemeral: true });
  }

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
    };
    guildAudioData.set(interaction.guildId, data);

    // Idle handler
    player.on(AudioPlayerStatus.Idle, () => {
      if (data.loop && data.queue.length > 0) {
        playStream(data, data.queue[0].url);
      } else if (data.queue.length > 1) {
        data.queue.shift();
        playStream(data, data.queue[0].url);
      } else {
        data.queue = [];
        data.playing = false;
        if (data.connection) {
          data.connection.destroy();
          guildAudioData.delete(interaction.guildId);
        }
      }
    });

    player.on('error', err => {
      console.error('Audio error:', err);
      data.playing = false;
    });
  }

  // add to queue
  data.queue.push({ url });
  await interaction.reply(`▶️ Added to queue: ${url}`);

  // if nothing is playing, start now
  if (!data.playing) {
    playStream(data, url);
  }
}

async function playStream(data, url) {
  try {
    if (!url) {
      console.error('❌ playStream called with invalid URL');
      return;
    }

    console.log('🎵 Now playing:', url);

    const directUrl = await getDirectAudioUrl(url);
    if (!directUrl) {
      console.error('❌ Failed to resolve direct audio URL');
      return;
    }

    const resource = createAudioResource(directUrl, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume.setVolume(data.volume);

    data.player.play(resource);
    data.playing = true;
  } catch (err) {
    console.error('Stream error:', err);

    if (data.queue.length > 0) data.queue.shift();

    if (data.queue.length > 0) {
      playStream(data, data.queue[0].url);
    } else {
      data.playing = false;
    }
  }
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

