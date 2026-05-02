const { comparePassword } = require('../utils/hashPassword');
const { signToken } = require('../utils/jwt');
const roles = require('../constants/roles');
const userModel = require('../models/userModel');
const userProfileModel = require('../models/userProfileModel');
const instructorProfileModel = require('../models/instructorProfileModel');

const ALLOWED_ROLES = new Set(Object.values(roles));

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const cleanText = (value) => (value || '').trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(email));

const toNullableText = (value) => {
  const cleaned = cleanText(value);
  return cleaned || null;
};

const normalizeFlag = (value, fallback = 0) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value > 0 ? 1 : 0;

  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return Number(fallback) > 0 ? 1 : 0;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return 1;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return 0;

  return Number(fallback) > 0 ? 1 : 0;
};

const getIncomingText = (value, fallbackValue = '') => {
  if (typeof value === 'undefined') return cleanText(fallbackValue);
  return cleanText(value);
};

function mapUserProfileSettings(profileRow) {
  return {
    phone: cleanText(profileRow?.phone || ''),
    city: cleanText(profileRow?.city || ''),
    institution: cleanText(profileRow?.institution || ''),
    bio: cleanText(profileRow?.bio || ''),
    profile_picture_url: cleanText(profileRow?.profile_picture_url || ''),
    notification_email: normalizeFlag(profileRow?.notification_email, 1),
    notification_workshop_updates: normalizeFlag(profileRow?.notification_workshop_updates, 1),
    notification_marketing: normalizeFlag(profileRow?.notification_marketing, 0),
    created_at: profileRow?.created_at || null,
    updated_at: profileRow?.updated_at || null,
  };
}

function mapUserWithProfile(user, profileRow) {
  const profile = mapUserProfileSettings(profileRow);

  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login: user.last_login,
    phone: profile.phone,
    city: profile.city,
    institution: profile.institution,
    bio: profile.bio,
    profile_picture_url: profile.profile_picture_url,
    notification_email: profile.notification_email,
    notification_workshop_updates: profile.notification_workshop_updates,
    notification_marketing: profile.notification_marketing,
    profile_created_at: profile.created_at,
    profile_updated_at: profile.updated_at,
  };
}

function toRoleFallbackDesignation(role) {
  if (role === roles.INSTRUCTOR) return 'Instructor';
  if (role === roles.SUPER_ADMIN) return 'Super Admin';
  return 'Admin';
}

function mapInstructorProfile(user, profileRow) {
  const primaryEmail = cleanText(profileRow?.primary_email || user?.email || '');

  return {
    userId: user?.id || null,
    displayName: cleanText(profileRow?.display_name || user?.full_name || ''),
    email: primaryEmail,
    designation: cleanText(profileRow?.designation || toRoleFallbackDesignation(user?.role)),
    alternativeEmail: cleanText(profileRow?.alternative_email || primaryEmail),
    bio: cleanText(profileRow?.bio || ''),
    description: cleanText(profileRow?.profile_description || ''),
    updatedAt: profileRow?.updated_at || null,
  };
}

async function login({ email, password, requiredRole }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = cleanText(password);
  const cleanRequiredRole = cleanText(requiredRole).toLowerCase();

  if (!normalizedEmail || !cleanPassword) {
    return { status: 400, body: { message: 'Email and password are required' } };
  }

  if (cleanRequiredRole && !ALLOWED_ROLES.has(cleanRequiredRole)) {
    return { status: 400, body: { message: 'Invalid role provided' } };
  }

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  if (user.is_active === 0 || user.is_active === false) {
    return { status: 403, body: { message: 'Account disabled' } };
  }

  if (cleanRequiredRole && user.role !== cleanRequiredRole) {
    return { status: 403, body: { message: 'Role is not authorized for this login' } };
  }

  const matches = await comparePassword(cleanPassword, user.password);
  if (!matches) {
    return { status: 401, body: { message: 'Invalid password' } };
  }

  await userModel.updateLastLogin(user.id);

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return {
    status: 200,
    body: {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    },
  };
}

async function getProfile(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  const profileRow = await userProfileModel.findByUserId(user.id);
  const profile = mapUserProfileSettings(profileRow);

  return {
    status: 200,
    body: {
      user: mapUserWithProfile(user, profileRow),
      profile,
    },
  };
}

async function updateProfile(userId, payload = {}) {
  const user = await userModel.findById(userId);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  const existingProfile = await userProfileModel.findByUserId(user.id);

  const incomingFullName = payload.fullName ?? payload.full_name;
  const fullName = getIncomingText(incomingFullName, user.full_name);
  const phone = getIncomingText(payload.phone, existingProfile?.phone);
  const city = getIncomingText(payload.city, existingProfile?.city);
  const institution = getIncomingText(payload.institution, existingProfile?.institution);
  const bio = getIncomingText(payload.bio, existingProfile?.bio);
  const incomingProfilePicture = payload.profilePictureUrl ?? payload.profile_picture_url;
  const profilePictureUrl = getIncomingText(incomingProfilePicture, existingProfile?.profile_picture_url);

  const notificationEmail = normalizeFlag(
    payload.notificationEmail ?? payload.notification_email,
    existingProfile?.notification_email ?? 1
  );
  const notificationWorkshopUpdates = normalizeFlag(
    payload.notificationWorkshopUpdates ?? payload.notification_workshop_updates,
    existingProfile?.notification_workshop_updates ?? 1
  );
  const notificationMarketing = normalizeFlag(
    payload.notificationMarketing ?? payload.notification_marketing,
    existingProfile?.notification_marketing ?? 0
  );

  if (!fullName) {
    return { status: 400, body: { message: 'Full name is required.' } };
  }

  if (fullName.length > 160) {
    return { status: 400, body: { message: 'Full name cannot exceed 160 characters.' } };
  }

  if (phone.length > 30) {
    return { status: 400, body: { message: 'Phone cannot exceed 30 characters.' } };
  }

  if (city.length > 120) {
    return { status: 400, body: { message: 'City cannot exceed 120 characters.' } };
  }

  if (institution.length > 180) {
    return { status: 400, body: { message: 'Institution cannot exceed 180 characters.' } };
  }

  if (bio.length > 5000) {
    return { status: 400, body: { message: 'Bio cannot exceed 5000 characters.' } };
  }

  if (profilePictureUrl.length > 2048) {
    return { status: 400, body: { message: 'Profile picture URL cannot exceed 2048 characters.' } };
  }

  if (fullName !== cleanText(user.full_name)) {
    await userModel.updateFullName(user.id, fullName);
  }

  const savedProfile = await userProfileModel.upsertByUserId(user.id, {
    phone: toNullableText(phone),
    city: toNullableText(city),
    institution: toNullableText(institution),
    bio: toNullableText(bio),
    profile_picture_url: toNullableText(profilePictureUrl),
    notification_email: notificationEmail,
    notification_workshop_updates: notificationWorkshopUpdates,
    notification_marketing: notificationMarketing,
  });

  const refreshedUser = await userModel.findById(user.id);

  return {
    status: 200,
    body: {
      message: 'Profile updated successfully.',
      user: mapUserWithProfile(refreshedUser || user, savedProfile),
      profile: mapUserProfileSettings(savedProfile),
    },
  };
}

async function getInstructorProfile(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  const profileRow = await instructorProfileModel.findByUserId(user.id);

  return {
    status: 200,
    body: {
      profile: mapInstructorProfile(user, profileRow),
    },
  };
}

async function updateInstructorProfile(userId, payload = {}) {
  const user = await userModel.findById(userId);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  const displayName = cleanText(payload.displayName);
  const email = normalizeEmail(payload.email);
  const designation = cleanText(payload.designation);
  const alternativeEmail = normalizeEmail(payload.alternativeEmail);
  const bio = cleanText(payload.bio);
  const description = cleanText(payload.description);

  if (!displayName) {
    return { status: 400, body: { message: 'Display Name is required.' } };
  }

  if (!email) {
    return { status: 400, body: { message: 'Primary Email is required.' } };
  }

  if (!isValidEmail(email)) {
    return { status: 400, body: { message: 'Primary Email must be a valid email address.' } };
  }

  if (!designation) {
    return { status: 400, body: { message: 'Designation is required.' } };
  }

  if (!alternativeEmail) {
    return { status: 400, body: { message: 'Alternative Email is required.' } };
  }

  if (!isValidEmail(alternativeEmail)) {
    return { status: 400, body: { message: 'Alternative Email must be a valid email address.' } };
  }

  if (bio.length > 500) {
    return { status: 400, body: { message: 'Bio cannot exceed 500 characters.' } };
  }

  if (description.length > 5000) {
    return { status: 400, body: { message: 'Description cannot exceed 5000 characters.' } };
  }

  const savedRow = await instructorProfileModel.upsertByUserId(user.id, {
    display_name: displayName,
    primary_email: email,
    designation,
    alternative_email: alternativeEmail,
    bio: toNullableText(bio),
    profile_description: toNullableText(description),
  });

  return {
    status: 200,
    body: {
      message: 'Instructor profile updated successfully.',
      profile: mapInstructorProfile(user, savedRow),
    },
  };
}

async function listAssignableInstructors() {
  const rows = await userModel.listActiveInstructors();

  return {
    status: 200,
    body: {
      instructors: rows.map((row) => ({
        id: Number(row.id),
        full_name: row.full_name,
        email: row.email,
        role: row.role,
      })),
    },
  };
}

module.exports = {
  login,
  getProfile,
  updateProfile,
  getInstructorProfile,
  updateInstructorProfile,
  listAssignableInstructors,
};