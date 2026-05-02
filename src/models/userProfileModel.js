const { authDB } = require('../config/db');

async function findByUserId(userId) {
  const [rows] = await authDB.query(
    `
      SELECT
        user_id,
        phone,
        city,
        institution,
        bio,
        profile_picture_url,
        notification_email,
        notification_workshop_updates,
        notification_marketing,
        created_at,
        updated_at
      FROM user_profiles
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function upsertByUserId(userId, payload) {
  await authDB.query(
    `
      INSERT INTO user_profiles (
        user_id,
        phone,
        city,
        institution,
        bio,
        profile_picture_url,
        notification_email,
        notification_workshop_updates,
        notification_marketing
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        phone = VALUES(phone),
        city = VALUES(city),
        institution = VALUES(institution),
        bio = VALUES(bio),
        profile_picture_url = VALUES(profile_picture_url),
        notification_email = VALUES(notification_email),
        notification_workshop_updates = VALUES(notification_workshop_updates),
        notification_marketing = VALUES(notification_marketing),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      payload.phone,
      payload.city,
      payload.institution,
      payload.bio,
      payload.profile_picture_url,
      payload.notification_email,
      payload.notification_workshop_updates,
      payload.notification_marketing,
    ]
  );

  return findByUserId(userId);
}

module.exports = {
  findByUserId,
  upsertByUserId,
};