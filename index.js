const { 
    Client, 
    GatewayIntentBits, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ==================== CONFIGURATION ====================
const TOKEN = process.env.DISCORD_TOKEN; // Set in your environment variable
const ALLOWED_GUILD_IDS = ['1273693018649792665']; // Your Server ID

// Your provided Discord CDN image link:
const VERIFY_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1525216451202646046/1549827586119700520/verifylogo.png?ex=6aac1cea&is=6aaacb6a&hm=e40d1f49e4edefe635c959340772d5198adae876ad1e64fc0a7cdf8427c9128f&'; 
// ========================================================


// Helper Function: Ensure Roles Exist Automatically
async function setupServerRoles(guild) {
    try {
        let unverifiedRole = guild.roles.cache.find(r => r.name === 'Unverified');
        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');

        // Create Unverified role if missing
        if (!unverifiedRole) {
            unverifiedRole = await guild.roles.create({
                name: 'Unverified',
                color: 0x808080, // Gray
                reason: 'Auto-created by Eagle Store Bot for verification system'
            });
            console.log(`Created 'Unverified' role in ${guild.name}`);
        }

        // Create Verified role if missing
        if (!verifiedRole) {
            verifiedRole = await guild.roles.create({
                name: 'Verified',
                color: 0xFFD700, // Gold
                reason: 'Auto-created by Eagle Store Bot for verification system'
            });
            console.log(`Created 'Verified' role in ${guild.name}`);
        }

        return { unverifiedRole, verifiedRole };
    } catch (error) {
        console.error(`Error auto-creating roles in ${guild.name}:`, error);
        return { unverifiedRole: null, verifiedRole: null };
    }
}

// 1. Security Check & Automatic Role Setup on Server Join
client.on('guildCreate', async (guild) => {
    if (ALLOWED_GUILD_IDS.length > 0 && !ALLOWED_GUILD_IDS.includes(guild.id)) {
        console.log(`Bot was added to unauthorized server: ${guild.name} (${guild.id}). Leaving...`);
        try { await guild.leave(); } catch (e) { console.error(e); }
        return;
    }

    // Auto-create roles when joining the server
    await setupServerRoles(guild);
});

client.once('ready', async () => {
    console.log(`Eagle Store Bot logged in as ${client.user.tag}!`);

    // Ensure roles exist on existing guilds on startup
    for (const guild of client.guilds.cache.values()) {
        if (ALLOWED_GUILD_IDS.length === 0 || ALLOWED_GUILD_IDS.includes(guild.id)) {
            await setupServerRoles(guild);
        }
    }
});

// 2. Auto-Assign Unverified Role when a member joins
client.on('guildMemberAdd', async (member) => {
    if (ALLOWED_GUILD_IDS.length > 0 && !ALLOWED_GUILD_IDS.includes(member.guild.id)) return;

    let { unverifiedRole } = await setupServerRoles(member.guild);
    if (unverifiedRole) {
        try {
            await member.roles.add(unverifiedRole);
            console.log(`Assigned Unverified role to ${member.user.tag}`);
        } catch (error) {
            console.error(`Failed to give unverified role to ${member.user.tag}:`, error);
        }
    }
});

// 3. Commands & Moderation Handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild || !message.content.startsWith('!')) return;

    if (ALLOWED_GUILD_IDS.length > 0 && !ALLOWED_GUILD_IDS.includes(message.guild.id)) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- VERIFICATION SETUP COMMAND ---
    // Command: !verify-setup
    if (command === 'verify-setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("You need Administrator permissions to run this.");
        }

        // Make sure roles exist before sending message
        await setupServerRoles(message.guild);

        const embed = new EmbedBuilder()
            .setTitle('Security')
            .setDescription('This server requires you to verify yourself to get access to other channels, you can simply verify by clicking on the verify button.')
            .setColor(0xFFD700) // Gold Color Accent
            .setImage(VERIFY_IMAGE_URL);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_btn')
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success) // Accent style
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => null);
    }

    // --- MODERATION COMMANDS ---
    
    // !kick @user [reason]
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) 
            return message.reply("You don't have permission to kick members.");
        
        const member = message.mentions.members.first();
        if (!member) return message.reply("Please mention a valid member.");
        if (!member.kickable) return message.reply("I cannot kick this user.");

        const reason = args.slice(1).join(' ') || 'No reason provided';
        await member.kick(reason);
        return message.channel.send(`Kicked **${member.user.tag}** | Reason: ${reason}`);
    }

    // !ban @user [reason]
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) 
            return message.reply("You don't have permission to ban members.");
        
        const member = message.mentions.members.first();
        if (!member) return message.reply("Please mention a valid member.");
        if (!member.bannable) return message.reply("I cannot ban this user.");

        const reason = args.slice(1).join(' ') || 'No reason provided';
        await member.ban({ reason });
        return message.channel.send(`Banned **${member.user.tag}** | Reason: ${reason}`);
    }

    // !timeout @user <minutes> [reason]
    if (command === 'timeout') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) 
            return message.reply("You don't have permission to timeout members.");

        const member = message.mentions.members.first();
        const duration = parseInt(args[1]);
        if (!member || isNaN(duration)) return message.reply("Usage: `!timeout @user <minutes> [reason]`");

        const reason = args.slice(2).join(' ') || 'No reason provided';
        await member.timeout(duration * 60 * 1000, reason);
        return message.channel.send(`Timed out **${member.user.tag}** for ${duration} minute(s).`);
    }

    // --- UTILITY COMMANDS ---

    // !event <title> | <description>
    if (command === 'event') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageEvents)) 
            return message.reply("You lack permissions to schedule events.");

        const content = args.join(' ').split('|');
        if (content.length < 2) return message.reply("Usage: `!event Title | Description`");

        const embed = new EmbedBuilder()
            .setTitle(`📅 Event: ${content[0].trim()}`)
            .setDescription(content[1].trim())
            .setColor(0xFFD700)
            .setFooter({ text: `Organized by ${message.author.tag}` });

        return message.channel.send({ embeds: [embed] });
    }

    // !giveaway <seconds> <prize>
    if (command === 'giveaway') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        const timeInSeconds = parseInt(args[0]);
        const prize = args.slice(1).join(' ');
        if (isNaN(timeInSeconds) || !prize) return message.reply("Usage: `!giveaway <seconds> <prize>`");

        const giveawayMsg = await message.channel.send(`🎉 **GIVEAWAY START!** 🎉\nPrize: **${prize}**\nReact with 🎉 to enter! Ends in ${timeInSeconds}s.`);
        await giveawayMsg.react('🎉');

        setTimeout(async () => {
            const fetchedMsg = await message.channel.messages.fetch(giveawayMsg.id);
            const reaction = fetchedMsg.reactions.cache.get('🎉');
            const users = await reaction.users.fetch();
            const validUsers = users.filter(u => !u.bot);

            if (validUsers.size === 0) {
                return message.channel.send(`Giveaway for **${prize}** ended. No valid entries.`);
            }

            const winner = validUsers.random();
            message.channel.send(`🎉 Congratulations ${winner}! You won **${prize}**!`);
        }, timeInSeconds * 1000);
    }
});

// 4. Verification Button Click Event
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'verify_btn') {
        const { unverifiedRole, verifiedRole } = await setupServerRoles(interaction.guild);

        if (!verifiedRole) {
            return interaction.reply({ content: '❌ Could not find or create the Verified role.', ephemeral: true });
        }

        const member = interaction.member;

        if (member.roles.cache.has(verifiedRole.id)) {
            return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
        }

        try {
            // Add Verified role
            await member.roles.add(verifiedRole);
            
            // Remove Unverified role if present
            if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                await member.roles.remove(unverifiedRole);
            }

            await interaction.reply({ content: '🛡️ You have successfully verified and unlocked the server!', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Role assignment failed. Ensure the bot role is higher than both Verified and Unverified roles in Server Settings -> Roles.', ephemeral: true });
        }
    }
});

// 5. Voice Channel AFK Auto-Mute/Move Tracker
client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.channelId && newState.channelId === newState.guild.afkChannelId) {
        console.log(`${newState.member.user.tag} joined the AFK Voice Channel.`);
    }
});

client.login(TOKEN);