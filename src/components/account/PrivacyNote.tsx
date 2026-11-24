import { Text } from 'react-native';

import { formStyles } from './Form';

/** What an account stores and where, in a few lines. */
export function PrivacyNote() {
  return (
    <Text style={formStyles.note}>
      An account keeps your username, how you sign in (a password stored only as a hash, or a passkey’s public key) and a
      copy of your library, in Cloudflare’s data centres in the EU. Friends you accept see the books on your shelf, with your
      ratings and reading dates; your notes stay private. Cover photos you took stay on the device. You can download your data or delete the
      account, with everything in it, any time in Settings.
    </Text>
  );
}
