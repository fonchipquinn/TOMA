import React, { useEffect, useState } from 'react';
import { Button, Spin } from 'antd';
import store from '@/utils/store';
import InfiniteScroll from 'react-infinite-scroller';
import CustomSpin from '@/components/custom-spin/custom-spin';
import TomatoxWaterfall from '@/components/tomatox-waterfall/tomatox-waterfall';
import { queryResources , queryDetail } from '@/utils/request/modules/queryResources';
import cssM from './recommend.scss';
import Indexed from '@/utils/db/indexed';
import { TABLES } from '@/utils/constants';
import { querySourceResource } from '@/utils/request/modules/querySource';

const path = require('path');
const fs = require("fs");

//获取本地json文件文件的路径
const source_path = path.join('res/source.json').replace(/\\/g, "\/");

export default class Recommend extends React.Component<any, any> {
    private page = 0;
    private pageCount = 10;
    private type = undefined;

    constructor(props: any) {
        super(props);
        this.state = {
            cardsData: [],
            recommendLoading: false
        };
    }

    async componentWillMount() {
        console.log('recommend 页面路径：', store.getState('CURRENT_PATH'));

        store.setState('GLOBAL_LOADING', true);
        this.initResource();
        this.updateHistorySource();
        store.subscribe('SITE_ADDRESS', () => {
            this.page = 0;
            this.pageCount = 10;
            this.setState(
                {
                    cardsData: [],
                    recommendLoading: false
                },
                this.initResource
            );
        });
    }

    async updateHistorySource() {
        const resHistory = await Indexed.instance!.queryAll(TABLES.TABLE_HISTORY);
        const resourcesHistory = resHistory as IplayResource[];
        for (const ele of resourcesHistory) {
            queryDetail(ele);
        }

        Indexed.instance?.deleteAll(TABLES.TABLE_ORIGIN);
        // let result = JSON.parse(fs.readFileSync(source_path));
        // const resSource = ((result) as Array<Iorigin>) || [];
        const resSource = ((await querySourceResource()) as Array<Iorigin>) || [];
        const resourcesSource = resSource as Iorigin[];
        console.log('初始化资源：', resourcesSource.length);
        for (const value of resourcesSource) {
            value.addTime = Date.now();
            Indexed.instance?.insertOrUpdateOrigin(TABLES.TABLE_ORIGIN, value);
        }
    }

    async initResource() {
        this.getRecommendLst();
    }

    getRecommendLst() {
        if (this.page >= this.pageCount) {
            return;
        }
        Promise.all([
            queryResources(++this.page, this.type, undefined, 24 * 30)
        ]).then(
            resLst => {
                const collectRes: IplayResource[] = [];
                resLst.forEach(res => {
                    if (!res) {
                        this.pageCount = 0;
                        return;
                    }
                    const { list, pagecount } = res;
                    this.pageCount = pagecount;
                    collectRes.push(...list);
                });
                if (store.getState('GLOBAL_LOADING')) {
                    store.setState('GLOBAL_LOADING', false);
                }
                this.setState({
                    recommendLoading: this.page < this.pageCount,
                    cardsData: [...this.state.cardsData, ...collectRes]
                });
            },
            reason => {
                if (store.getState('GLOBAL_LOADING')) {
                    store.setState('GLOBAL_LOADING', false);
                }
            }
        );
    }

    render(): React.ReactNode {
        return (
            <div className={cssM.scrollWrapper}>
                <InfiniteScroll
                    initialLoad={false}
                    pageStart={1}
                    loadMore={this.getRecommendLst.bind(this)}
                    hasMore={this.page < this.pageCount}
                    useWindow={false}>
                    <TomatoxWaterfall data={this.state.cardsData} isDisplayDelete={false} />
                    <div style={{ height: 100, position: 'relative' }}>
                        <Spin
                            size={'large'}
                            indicator={<CustomSpin />}
                            spinning={this.state.recommendLoading}
                            />
                    </div>
                </InfiniteScroll>
            </div>
        );
    }
}
