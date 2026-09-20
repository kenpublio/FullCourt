<?php
require 'backend/utils/Mailer.php';
$m = Mailer::fromEnv();
$result = $m->send('test@evsu.edu.ph', 'Test', 'Test body');
var_dump($result);