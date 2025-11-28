import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import User from "../models/User.model.js";

export default function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        const newUser = {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          avatarUrl: profile.photos[0].value,
          role: "citizen",
        };

        try {
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            return done(null, user);
          }

          user = await User.findOne({ email: newUser.email });
          if (user) {
            user.googleId = newUser.googleId;
            user.avatarUrl = user.avatarUrl || newUser.avatarUrl;
            await user.save();
            return done(null, user);
          }

          user = await User.create(newUser);
          return done(null, user);
        } catch (err) {
          console.error(err);
          return done(err);
        }
      }
    )
  );
}
