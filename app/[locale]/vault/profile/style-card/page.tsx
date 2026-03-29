import { getProfileHubData } from '@/app/actions/vault/profile';
import { getJourneyStats } from '@/app/actions/vault/journey';
import { redirect } from 'next/navigation';
import StyleCardClient from '@/components/vault/StyleCardClient';

export default async function StyleCardPage() {
    const [hubData, journey] = await Promise.all([
        getProfileHubData(),
        getJourneyStats(),
    ]);

    if (!hubData || !hubData.profile) {
        redirect('/login');
    }

    const { profile, essence } = hubData;

    return (
        <StyleCardClient
            profile={profile}
            essence={essence}
            journey={journey}
        />
    );
}
