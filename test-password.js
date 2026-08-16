import bcrypt from 'bcryptjs';

const passwordHash = "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJByJ.Xd5c3z2y7BZ8K";
const password = "admin123";

bcrypt.compare(password, passwordHash).then(result => {
  console.log("Password 'admin123' matches hash:", result);

  // Also generate a new hash to verify
  bcrypt.hash(password, 10).then(newHash => {
    console.log("\nNew hash for 'admin123':", newHash);
    bcrypt.compare(password, newHash).then(r => {
      console.log("Verification of new hash:", r);
    });
  });
});
