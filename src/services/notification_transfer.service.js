const pool = require('../config/database');
const axios = require('axios');

async function fetchTransfersByPlayer(playerId) {
  const response = await axios.get(
    'https://api-football-v1.p.rapidapi.com/v3/transfers',
    {
      params: { player: playerId },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      },
    }
  );

  return response.data?.response || [];
}

async function getTrackedPlayerSubscriptions() {
  const result = await pool.query(
    `
    SELECT user_id, source_id AS player_id
    FROM notification_subscriptions
    WHERE source_type = 'player'
      AND is_enabled = true
    `
  );

  return result.rows;
}

async function getTrackedTeamSubscriptions() {
  const result = await pool.query(
    `
    SELECT user_id, source_id AS team_id
    FROM notification_subscriptions
    WHERE source_type = 'team'
      AND is_enabled = true
    `
  );

  return result.rows;
}

async function transferAlreadySent({
  userId,
  playerId,
  teamId,
  transferDate,
  transferType,
  fromTeamName,
  toTeamName,
}) {
  const result = await pool.query(
    `
    SELECT 1
    FROM notification_transfer_history
    WHERE user_id = $1
      AND COALESCE(player_id, -1) = COALESCE($2, -1)
      AND COALESCE(team_id, -1) = COALESCE($3, -1)
      AND COALESCE(transfer_date, '') = COALESCE($4, '')
      AND COALESCE(transfer_type, '') = COALESCE($5, '')
      AND COALESCE(from_team_name, '') = COALESCE($6, '')
      AND COALESCE(to_team_name, '') = COALESCE($7, '')
    LIMIT 1
    `,
    [
      userId,
      playerId,
      teamId,
      transferDate,
      transferType,
      fromTeamName,
      toTeamName,
    ]
  );

  return result.rows.length > 0;
}

async function storeTransferSent({
  userId,
  playerId,
  teamId,
  transferDate,
  transferType,
  fromTeamName,
  toTeamName,
}) {
  await pool.query(
    `
    INSERT INTO notification_transfer_history (
      user_id,
      player_id,
      team_id,
      transfer_date,
      transfer_type,
      from_team_name,
      to_team_name
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT DO NOTHING
    `,
    [
      userId,
      playerId,
      teamId,
      transferDate,
      transferType,
      fromTeamName,
      toTeamName,
    ]
  );
}

async function createAppNotification({
  userId,
  sourceType,
  sourceId,
  eventType,
  title,
  message,
  metadata = {},
}) {
  await pool.query(
    `
    INSERT INTO app_notifications (
      user_id,
      source_type,
      source_id,
      fixture_id,
      event_type,
      title,
      message,
      metadata
    )
    VALUES ($1,$2,$3,NULL,$4,$5,$6,$7)
    `,
    [userId, sourceType, sourceId, eventType, title, message, metadata]
  );
}

function normalizeTransferRows(playerTransferResponse) {
  const player = playerTransferResponse?.player || {};
  const transfers = Array.isArray(playerTransferResponse?.transfers)
    ? playerTransferResponse.transfers
    : [];

  return transfers.map((transfer) => ({
    playerId: player.id ?? null,
    playerName: player.name ?? 'Joueur',
    playerPhoto: player.photo ?? '',
    transferDate: transfer?.date ?? '',
    transferType: transfer?.type ?? '',
    fromTeamId: transfer?.teams?.out?.id ?? null,
    fromTeamName: transfer?.teams?.out?.name ?? '',
    fromTeamLogo: transfer?.teams?.out?.logo ?? '',
    toTeamId: transfer?.teams?.in?.id ?? null,
    toTeamName: transfer?.teams?.in?.name ?? '',
    toTeamLogo: transfer?.teams?.in?.logo ?? '',
  }));
}

async function processPlayerTransferSubscriptions() {
  const trackedPlayers = await getTrackedPlayerSubscriptions();

  for (const row of trackedPlayers) {
    const userId = row.user_id;
    const playerId = Number(row.player_id);

    if (!playerId) continue;

    let responses = [];
    try {
      responses = await fetchTransfersByPlayer(playerId);
    } catch (err) {
      console.error('Player transfer fetch error:', err.message);
      continue;
    }

    const transfers = responses.flatMap(normalizeTransferRows);

    for (const transfer of transfers) {
      const alreadySent = await transferAlreadySent({
        userId,
        playerId: transfer.playerId,
        teamId: null,
        transferDate: transfer.transferDate,
        transferType: transfer.transferType,
        fromTeamName: transfer.fromTeamName,
        toTeamName: transfer.toTeamName,
      });

      if (alreadySent) continue;

      await createAppNotification({
        userId,
        sourceType: 'player',
        sourceId: transfer.playerId,
        eventType: 'transfer_news',
        title: `${transfer.playerName}`,
        message: `Transfert: ${transfer.fromTeamName} → ${transfer.toTeamName}`,
        metadata: {
          player_id: transfer.playerId,
          player_name: transfer.playerName,
          player_photo: transfer.playerPhoto,
          from_team_id: transfer.fromTeamId,
          from_team_name: transfer.fromTeamName,
          from_team_logo: transfer.fromTeamLogo,
          to_team_id: transfer.toTeamId,
          to_team_name: transfer.toTeamName,
          to_team_logo: transfer.toTeamLogo,
          transfer_date: transfer.transferDate,
          transfer_type: transfer.transferType,
        },
      });

      await storeTransferSent({
        userId,
        playerId: transfer.playerId,
        teamId: null,
        transferDate: transfer.transferDate,
        transferType: transfer.transferType,
        fromTeamName: transfer.fromTeamName,
        toTeamName: transfer.toTeamName,
      });
    }
  }
}

async function processTeamTransferSubscriptions() {
  const trackedTeams = await getTrackedTeamSubscriptions();

  const usersByTeam = new Map();

  for (const row of trackedTeams) {
    const teamId = Number(row.team_id);
    if (!teamId) continue;

    if (!usersByTeam.has(teamId)) {
      usersByTeam.set(teamId, []);
    }

    usersByTeam.get(teamId).push(row.user_id);
  }

  const processedPlayers = new Set();

  for (const [teamId, userIds] of usersByTeam.entries()) {
    let teamTransfers = [];

    try {
      const result = await pool.query(
        `
        SELECT DISTINCT source_id AS player_id
        FROM notification_subscriptions
        WHERE source_type = 'player'
          AND is_enabled = true
        `
      );

      const playerIds = result.rows.map((r) => Number(r.player_id)).filter(Boolean);

      for (const playerId of playerIds) {
        if (processedPlayers.has(playerId)) continue;

        let responses = [];
        try {
          responses = await fetchTransfersByPlayer(playerId);
        } catch (err) {
          console.error('Team transfer player fetch error:', err.message);
          continue;
        }

        const transfers = responses.flatMap(normalizeTransferRows);

        for (const transfer of transfers) {
          if (transfer.fromTeamId === teamId || transfer.toTeamId === teamId) {
            teamTransfers.push(transfer);
          }
        }

        processedPlayers.add(playerId);
      }
    } catch (err) {
      console.error('Team transfer processing error:', err.message);
      continue;
    }

    for (const transfer of teamTransfers) {
      for (const userId of userIds) {
        const alreadySent = await transferAlreadySent({
          userId,
          playerId: transfer.playerId,
          teamId,
          transferDate: transfer.transferDate,
          transferType: transfer.transferType,
          fromTeamName: transfer.fromTeamName,
          toTeamName: transfer.toTeamName,
        });

        if (alreadySent) continue;

        await createAppNotification({
          userId,
          sourceType: 'team',
          sourceId: teamId,
          eventType: 'transfer_news',
          title: `${transfer.playerName}`,
          message: `Transfert lié à l'équipe suivie: ${transfer.fromTeamName} → ${transfer.toTeamName}`,
          metadata: {
            player_id: transfer.playerId,
            player_name: transfer.playerName,
            player_photo: transfer.playerPhoto,
            team_id: teamId,
            from_team_id: transfer.fromTeamId,
            from_team_name: transfer.fromTeamName,
            from_team_logo: transfer.fromTeamLogo,
            to_team_id: transfer.toTeamId,
            to_team_name: transfer.toTeamName,
            to_team_logo: transfer.toTeamLogo,
            transfer_date: transfer.transferDate,
            transfer_type: transfer.transferType,
          },
        });

        await storeTransferSent({
          userId,
          playerId: transfer.playerId,
          teamId,
          transferDate: transfer.transferDate,
          transferType: transfer.transferType,
          fromTeamName: transfer.fromTeamName,
          toTeamName: transfer.toTeamName,
        });
      }
    }
  }
}

exports.runTransferNotificationEngine = async () => {
  await processPlayerTransferSubscriptions();
  await processTeamTransferSubscriptions();

  return { success: true };
};