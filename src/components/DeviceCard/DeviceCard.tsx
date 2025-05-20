// DeviceCard.tsx
import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

interface DeviceCardProps {
    device: string;
    ip: string;
    lastSeen?: string;
    status?: string;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, ip, lastSeen, status }) => (
    <Card sx={{ maxWidth: 345, margin: 2 }}>
        <CardHeader
            title={device}
            subheader={ip}
        />
        <CardContent>
            <Typography variant="body2" color="text.secondary">
                Status: {status || 'Unknown'}
            </Typography>
            {lastSeen && (
                <Typography variant="body2" color="text.secondary">
                    Last Seen: {lastSeen}
                </Typography>
            )}
        </CardContent>
        <CardActions>
            <Button size="small">Power</Button>
            <Button size="small">Volume Up</Button>
            <Button size="small">Volume Down</Button>
        </CardActions>
    </Card>
);

export default DeviceCard;