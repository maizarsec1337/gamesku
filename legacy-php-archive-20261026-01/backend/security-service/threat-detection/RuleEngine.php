<?php
class RuleEngine
{
    public static function evaluate(array $event): array
    {
        $rules = [
            'idor_attempt' => fn($e) => ($e['type'] ?? '') === 'idor_attempt',
            'privilege_escalation' => fn($e) => ($e['type'] ?? '') === 'role_change' && ($e['outcome'] ?? '') === 'denied',
        ];
        $matched = [];
        foreach ($rules as $name => $fn) {
            if ($fn($event)) {
                $matched[] = $name;
            }
        }
        return $matched;
    }
}
