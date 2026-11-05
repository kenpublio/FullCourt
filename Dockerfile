FROM php:8.5-cli

RUN docker-php-ext-install pdo_mysql

WORKDIR /app

COPY . .

RUN mkdir -p backend/uploads \
    && chown -R www-data:www-data backend/uploads

EXPOSE 8080

CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} -t backend backend/index.php"]
