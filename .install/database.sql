CREATE DATABASE nwleaderboard_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nwleaderboard_dev'@'%' IDENTIFIED BY 'nwleaderboard_dev_password';
GRANT ALL PRIVILEGES ON nwleaderboard_dev.* TO 'nwleaderboard_dev'@'%';
FLUSH PRIVILEGES;

CREATE DATABASE nwleaderboard_rec CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nwleaderboard_rec'@'%' IDENTIFIED BY 'nwleaderboard_rec_password';
GRANT ALL PRIVILEGES ON nwleaderboard_rec.* TO 'nwleaderboard_rec'@'%';
FLUSH PRIVILEGES;

CREATE DATABASE nwleaderboard_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nwleaderboard_pro'@'%' IDENTIFIED BY 'nwleaderboard_pro_password';
GRANT ALL PRIVILEGES ON nwleaderboard_pro.* TO 'nwleaderboard_pro'@'%';
FLUSH PRIVILEGES;
