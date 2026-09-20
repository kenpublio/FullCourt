<?php

final class RegistrationDetails {
    public static function validate(array $input, string $role, int $age): array {
        $details = [];
        if ($role === 'player') {
            $position = trim($input['playing_position'] ?? 'Not Sure');
            if (!in_array($position, ['Not Sure','Point Guard','Shooting Guard','Small Forward','Power Forward','Center'], true)) {
                throw new InvalidArgumentException('Choose a valid playing position.');
            }
            $height = $input['height_cm'] ?? '';
            if ($height !== '' && (!is_numeric($height) || (float)$height <= 0 || (float)$height > 300)) {
                throw new InvalidArgumentException('Enter a valid height in centimeters (up to 300).');
            }
            $details = ['playing_position'=>$position === 'Not Sure' ? null : $position, 'height_cm'=>$height === '' ? null : round((float)$height, 2)];
        } elseif ($role === 'coach') {
            $team = trim($input['team_name'] ?? '');
            $experience = $input['coaching_experience'] ?? '';
            if (strlen($team) > 150) throw new InvalidArgumentException('Team name must not exceed 150 characters.');
            if ($experience !== '' && filter_var($experience, FILTER_VALIDATE_INT, ['options'=>['min_range'=>0,'max_range'=>$age]]) === false) {
                throw new InvalidArgumentException('Coaching experience must be a whole number between 0 and your age.');
            }
            $details = ['team_name'=>$team ?: null, 'coaching_experience'=>$experience === '' ? null : (int)$experience];
        } elseif ($role === 'organization_admin') {
            foreach (['organization_name'=>150,'organization_address'=>1000] as $field=>$max) {
                $value = trim($input[$field] ?? '');
                if ($value === '' || strlen($value) > $max) throw new InvalidArgumentException('Organization name and address are required and must fit their length limits.');
                $details[$field] = $value;
            }
        }
        return $details;
    }
}
